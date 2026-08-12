import { Request, Response } from 'express';
import { catchAsync } from "../utils/catchAsync";
import Stripe from 'stripe';
import Payment from '../models/Payment.model';
import { PaymentStatus } from '../models/enums/PaymentStatus.enum';
import { PaymentProvider } from '../models/enums/PaymentProvider.enum';
import { PaymentMethod } from '../models/enums/PaymentMethod.enum';
import { PayPalWebhookEvent } from '../models/enums/PayPalWebhookEvent.enum';
import { IPayment } from '../models/interfaces/Payment.interface';
import { ApiError } from '../utils/ApiError';
import Shipment from '../models/Shipment.model';
import Quote, { IQuote } from '../models/Quote.model';
import { createCheckoutSession } from '../services/payment';
import { stripe } from '../services/payment/stripe';
import { fromMinorUnits } from '../services/payment/currency';
import { OrderStatus } from '@paypal/paypal-server-sdk';
import { createPayPalOrder, capturePayPalOrder } from '../services/paypal';
import { fromPayPalAmount } from '../services/paypal/currency';
import { verifyPayPalWebhook, extractPayPalHeaders } from '../services/paypal/webhook';
import { sendPaymentConfirmationEmail } from '../services/email';
import { Status } from '../models/enums/Status.enum';
import logger from '../utils/logger';
import WebhookEvent from '../models/WebhookEvent.model';
import { UserType } from '../models/enums/UserType.enum';

/**
 * PayPal branch of `create` (guide Phase 2 section 2). Runs after the shared front-half
 * (quote lookup, ownership, approval, already-paid guard) has passed.
 *
 * Mirrors the Stripe branch's persist-then-respond contract: create the PayPal order,
 * store a Payment record (provider `paypal`, `paypalOrderId`, Unpaid) BEFORE returning,
 * then hand the frontend the approval URL to redirect to. As with Stripe, no email or
 * shipment happens here — the webhook (PAYMENT.CAPTURE.COMPLETED) is the source of truth.
 */
const createPayPalPayment = async (
    req: Request,
    res: Response,
    quote: IQuote,
    existing: IPayment | null,
): Promise<Response> => {
    // Return/cancel URLs are built by us, same principle as the Stripe success/cancel
    // URLs. The return URL carries the quote ref so the return handler can look up the
    // record; PayPal also appends `?token=<orderId>` on redirect.
    const frontendUrl = process.env.FRONTEND_URL as string;
    const returnUrl = `${process.env.BACKEND_URL}/api/payment/paypal/return?quoteRef=${quote.quoteNumber}`;
    const cancelUrl = `${frontendUrl}/payment/cancel?quoteRef=${quote.quoteNumber}`;

    const { orderId, approvalUrl } = await createPayPalOrder(quote, returnUrl, cancelUrl);

    // Same atomic find-or-create keyed on the unique `quoteReference` as the Stripe
    // branch, so concurrent inits converge on one record. The order id is stored
    // immediately so a refund/dispute/support lookup can find it even if the buyer
    // never returns from PayPal.
    let payment: IPayment | null;
    try {
        payment = await Payment.findOneAndUpdate(
            { quoteReference: quote.quoteNumber },
            {
                $set: {
                    provider: PaymentProvider.Paypal,
                    paymentUrl: approvalUrl,
                    paypalOrderId: orderId,
                    // Lock the expected amount + currency from the quote at creation time.
                    // Webhook fulfillment verifies the captured money against these.
                    expectedAmount: quote.pricing.totalAmount,
                    expectedCurrency: quote.pricing.currency?.toUpperCase(),
                    updatedBy: req.user?._id,
                },
                $setOnInsert: {
                    quoteId: quote._id,
                    createdBy: req.user?._id,
                    quoteReference: quote.quoteNumber,
                    status: PaymentStatus.Unpaid,
                },
            },
            { new: true, upsert: true }
        );
    } catch (err: any) {
        if (err?.code === 11000) {
            payment = await Payment.findOne({ quoteReference: quote.quoteNumber });
        } else {
            throw err;
        }
    }

    if (existing?.paypalOrderId && existing.paypalOrderId !== orderId) {
        // A prior PayPal order for this quote is being superseded. PayPal orders expire
        // on their own (no explicit cancel call in the SDK), and the webhook/return
        // handlers are scoped so a stale order can't flip the fresh record — so this is
        // just logged for traceability, mirroring the Stripe expire-old-session step.
        logger.info(`Superseding previous PayPal order ${existing.paypalOrderId} for quote ${quote.quoteNumber}`);
    }

    return res.status(200).json({
        success: true,
        message: 'PayPal order created',
        provider: PaymentProvider.Paypal,
        approvalUrl,
        orderId,
    });
};

/**
 * @desc    Create a payment for an approved quote — Stripe Checkout Session
 *          (`card`/`bank_transfer`) or a PayPal order (`paypal`)
 * @route   POST /api/payment/create
 * @access  Customer (authenticated) — the customer initiates their own checkout
 *
 * Frontend-redirect flow: this returns the hosted checkout/approval URL for the client
 * to redirect the browser to. No email is sent here — the payment confirmation email
 * goes out from the webhook once payment is actually confirmed, for either provider.
 */
export const create = catchAsync(async (req: Request, res: Response) => {
    const { quoteId, paymentMethod } = req.body;

    // Populate the originating request so we can confirm ownership below.
    const quote = await Quote.findById(quoteId).populate('quoteRequestId');
    if (!quote) throw new ApiError(400, 'Invalid quote');

    // A customer may only pay for their own quote. The owning user lives on the
    // QuoteRequest this quote was generated from (mirrors the ownership check in
    // getUserQuoteRequests). Guards against paying an arbitrary quote by id.
    const request = quote.quoteRequestId as any;
    if (!request?.user || request.user.toString() !== req.user?._id.toString()) {
        throw new ApiError(403, 'You are not authorized to pay for this quote');
    }

    if (quote.status != Status.Approved) throw new ApiError(400, 'Payment can only be initiated for approved quotes');

    // Reject re-initiation for an already-paid quote up front (terminal state, safe as a read).
    const existing = await Payment.findOne({ quoteId: quote._id });
    if (existing && existing.status == PaymentStatus.Paid) throw new ApiError(400, 'Payment is already paid for');

    // Branch on the selected method. `card`/`bank_transfer` are fulfilled by Stripe;
    // `paypal` is fulfilled by PayPal's own redirect flow. Everything above this line
    // (quote lookup, ownership, approval, already-paid guard) is shared by both.
    if (paymentMethod === PaymentMethod.Paypal) {
        return createPayPalPayment(req, res, quote as unknown as IQuote, existing);
    }

    const session = await createCheckoutSession(quote, paymentMethod);

    // Atomic find-or-create keyed on the unique `quoteReference`. Combined with the
    // unique sparse index on that field, this prevents two concurrent admins from
    // ending up with two payment records for the same quote — the loser's upsert updates
    // the same document instead of inserting a second. (A rare concurrent insert can raise
    // a duplicate-key error; we re-fetch the winning record in that case.)
    //
    // Stripe's session id is stored immediately (guide 1.8) so a refund/dispute/support
    // interaction can find it even if the customer never completes checkout.
    let payment: IPayment | null;
    try {
        payment = await Payment.findOneAndUpdate(
            { quoteReference: quote.quoteNumber },
            {
                $set: {
                    provider: PaymentProvider.Stripe,
                    paymentUrl: session.url,
                    stripeSessionId: session.id,
                    // Lock the expected amount + currency from the quote at creation time.
                    // Webhook fulfillment verifies the settled money against these.
                    expectedAmount: quote.pricing.totalAmount,
                    expectedCurrency: quote.pricing.currency?.toUpperCase(),
                    updatedBy: req.user?._id,
                },
                $setOnInsert: {
                    quoteId: quote._id,
                    createdBy: req.user?._id,
                    quoteReference: quote.quoteNumber,
                    status: PaymentStatus.Unpaid
                }
            },
            { new: true, upsert: true }
        );
    } catch (err: any) {
        if (err?.code === 11000) {
            payment = await Payment.findOne({ quoteReference: quote.quoteNumber });
        } else {
            throw err;
        }
    }

    // Regeneration: if this quote already had a prior Checkout Session, expire that OLD
    // session on Stripe's side so we never leave two payable links live for one quote.
    // Done AFTER the record above is repointed at the new session id, so the resulting
    // `checkout.session.expired` webhook (scoped to the old session id) can't flip the
    // fresh record to Expired. Best-effort: a session that already completed or expired
    // throws here, which is harmless — the new link is already issued.
    if (existing?.stripeSessionId && existing.stripeSessionId !== session.id) {
        try {
            await stripe.checkout.sessions.expire(existing.stripeSessionId);
            logger.info(`Expired previous session ${existing.stripeSessionId} for quote ${quote.quoteNumber}`);
        } catch (err: any) {
            logger.warn(`Could not expire previous session ${existing.stripeSessionId}: ${err.message}`);
        }
    }

    return res.status(200).json({
        success: true,
        message: 'Checkout session created',
        checkoutUrl: session.url,
        sessionId: session.id,
        expiresAt: session.expires_at,
    });
});

/**
 * Idempotent fulfillment: ensure exactly one Shipment exists for a paid payment.
 * Keyed on the payment id and guarded by the unique sparse index on `Shipment.payment`,
 * so a Stripe webhook retry (or a concurrent duplicate delivery) can't create a second
 * shipment. A concurrent insert that loses the race raises 11000, which we treat as
 * "already fulfilled".
 */
const ensureShipment = async (payment: IPayment): Promise<void> => {
    try {
        await Shipment.findOneAndUpdate(
            { payment: payment._id },
            { $setOnInsert: { quote: payment.quoteId, payment: payment._id } },
            { upsert: true, new: true }
        );
    } catch (err: any) {
        if (err?.code !== 11000) throw err;
    }
};

/**
 * Shared fulfillment tail for a confirmed payment, provider-agnostic. Given a payment
 * record and whether THIS delivery was the fresh Unpaid→Paid winner, it creates the
 * shipment (always, idempotently) and sends the confirmation email (only on the fresh
 * transition, so a webhook retry never double-sends). The display amount/currency are
 * passed in already converted, since Stripe (minor units) and PayPal (decimal string)
 * express them differently.
 */
const fulfillPaidPayment = async (
    payment: IPayment,
    fresh: boolean,
    quoteRef: string,
    displayAmount: number,
    displayCurrency: string,
): Promise<void> => {
    await ensureShipment(payment);

    if (!fresh) return;
    try {
        const quote = await Quote.findById(payment.quoteId).populate('quoteRequestId');
        const request = quote?.quoteRequestId as any;
        if (request?.customer?.email) {
            await sendPaymentConfirmationEmail(
                request.customer.email,
                request.customer.fullName,
                displayAmount,
                displayCurrency,
                quoteRef,
                `${process.env.FRONTEND_URL}/receipts/${payment._id}`
            );
        }
    } catch (emailError) {
        logger.error('Failed to send payment confirmation email:', emailError);
        // Continue — payment and shipment are already recorded.
    }
    logger.info(`Quote ${quoteRef} paid successfully`);
};

/**
 * Defense-in-depth amount check for a confirmed payment, shared by both providers. The
 * provider fixes the amount server-side at creation, so the settled money SHOULD always
 * equal what we locked in (`expectedAmount`/`expectedCurrency`). A divergence means
 * something anomalous — a partial capture, a quote mutated after creation, or a provider
 * bug — so the caller refuses to auto-fulfill and flags it for a human instead.
 *
 * Amounts compare to within half a cent to absorb float representation; currency compares
 * case-insensitively. Both sides are major-unit (Stripe's minor units are converted before
 * the call). Fails OPEN when no expectation is stored (records predating this guard) — the
 * amount was still provider-fixed at creation, so those keep prior behavior.
 */
const capturedAmountMatchesExpectation = (
    payment: IPayment,
    capturedAmount: number,
    capturedCurrency: string,
): boolean => {
    const { expectedAmount, expectedCurrency } = payment;
    if (expectedAmount == null || !expectedCurrency) return true; // nothing to check against

    const amountMatches = Math.abs(Number(expectedAmount) - capturedAmount) < 0.005;
    const currencyMatches = expectedCurrency.toUpperCase() === capturedCurrency.toUpperCase();
    return amountMatches && currencyMatches;
};

/**
 * Handle a confirmed payment (a card `checkout.session.completed` with
 * `payment_status: paid`, or an async method's `async_payment_succeeded`).
 *
 * The Unpaid→Paid transition is atomic and conditional on the record NOT already
 * being Paid, so only the first delivery to win it is treated as "fresh" (used to
 * gate the one-time confirmation email). Shipment creation runs regardless of who
 * won, so a retry after a crash between the flip and fulfillment still creates the
 * shipment rather than silently dropping it.
 */
const handleSuccessfulPayment = async (session: Stripe.Checkout.Session): Promise<void> => {
    const quoteRef = session.client_reference_id ?? session.metadata?.quoteRef;
    if (!quoteRef) {
        logger.error(`Checkout session ${session.id} completed with no quote reference; cannot reconcile`);
        return;
    }

    const paymentIntentId = typeof session.payment_intent === 'string'
        ? session.payment_intent
        : session.payment_intent?.id;

    const capturedCurrency = (session.currency ?? 'USD').toUpperCase();
    // Stripe reports amount_total in minor units; convert to major units to compare
    // against the stored expectation (which is in major units, from the quote).
    const capturedAmount = fromMinorUnits(session.amount_total ?? 0, session.currency ?? 'USD');

    // Load first to read the expectation locked at session-creation time.
    const existing = await Payment.findOne({ quoteReference: quoteRef });
    if (!existing) {
        logger.error(`No payment record for quote ${quoteRef}; cannot fulfill payment`);
        return;
    }

    // Defense-in-depth: settled money must match what we committed to at checkout creation.
    // A mismatch is flagged for reconciliation, not fulfilled. (Same guard as the PayPal path.)
    if (!capturedAmountMatchesExpectation(existing, capturedAmount, capturedCurrency)) {
        logger.error(
            `Stripe payment amount mismatch for quote ${quoteRef}: expected ` +
            `${existing.expectedAmount} ${existing.expectedCurrency}, received ` +
            `${capturedAmount} ${capturedCurrency} (session ${session.id}). ` +
            `Not fulfilling — flagged for manual reconciliation.`
        );
        // Record what settled (Stripe stores amount_total in minor units) for the reviewer,
        // only while not already Paid — never clobber a legitimately completed payment.
        await Payment.findOneAndUpdate(
            { quoteReference: quoteRef, status: { $ne: PaymentStatus.Paid } },
            {
                amountMismatch: true,
                amountPaid: session.amount_total,
                currency: capturedCurrency,
                stripeSessionId: session.id,
                stripePaymentIntentId: paymentIntentId,
            }
        );
        return;
    }

    const fresh = await Payment.findOneAndUpdate(
        { quoteReference: quoteRef, status: { $ne: PaymentStatus.Paid } },
        {
            status: PaymentStatus.Paid,
            paidAt: new Date(),
            amountPaid: session.amount_total,
            currency: capturedCurrency,
            stripeSessionId: session.id,
            stripePaymentIntentId: paymentIntentId,
        },
        { new: true }
    );

    // On a retry after the flip already happened the record is already Paid (fresh === null);
    // reuse the copy we loaded so fulfillment stays idempotently correct.
    const payment = fresh ?? existing;
    await fulfillPaidPayment(payment, Boolean(fresh), quoteRef, capturedAmount, capturedCurrency);
};

/**
 * Mark a payment as failed. Conditional on the record NOT already being Paid, so an
 * out-of-order or late failure event can never overwrite a successful payment.
 */
const handleFailedPayment = async (
    quoteRef: string | null | undefined,
    reason: string
): Promise<void> => {
    if (!quoteRef) return;
    await Payment.findOneAndUpdate(
        { quoteReference: quoteRef, status: { $ne: PaymentStatus.Paid } },
        { status: PaymentStatus.Failed }
    );
    logger.info(`Quote ${quoteRef} payment failed: ${reason}`);
};

/**
 * Mark a payment as expired when its Checkout Session times out unused.
 *
 * Scoped to THIS exact session (stripeSessionId) and only while the record is
 * still Unpaid, so a stale expiry event can never overwrite a regenerated link
 * (which has a newer session id) or a payment that has since completed.
 */
const handleExpiredPayment = async (session: Stripe.Checkout.Session): Promise<void> => {
    const quoteRef = session.client_reference_id ?? session.metadata?.quoteRef;
    if (!quoteRef) return;
    await Payment.findOneAndUpdate(
        { quoteReference: quoteRef, stripeSessionId: session.id, status: PaymentStatus.Unpaid },
        { status: PaymentStatus.Expired }
    );
    logger.info(`Session ${session.id} for quote ${quoteRef} expired`);
};

/**
 * @desc    Stripe webhook — the only trustworthy signal that a payment completed
 * @route   POST /stripe/webhook
 * @access  Public (authenticated by Stripe signature, not by our auth layer)
 */
export const webhook = catchAsync(async (req: Request, res: Response) => {
    let event: Stripe.Event;
    const signature: string | string[] = req.headers['stripe-signature'] || '';

    try {
        // Signature verification needs the exact raw bytes Stripe sent (guide 1.5);
        // this route is mounted with express.raw() before the global JSON parser.
        event = stripe.webhooks.constructEvent(
            req.body,
            signature,
            process.env.STRIPE_WEBHOOK_SECRET || ''
        );
    } catch (err: any) {
        // A bad signature is a malformed/unauthenticated request, not a processing
        // failure — 400 so Stripe does not retry (guide 1.5).
        logger.warn(`Webhook signature verification failed: ${err.message}`);
        return res.sendStatus(400);
    }

    // Durable audit trail + event-level idempotency guard (guide 1.5). Skip only if a
    // PRIOR delivery already SUCCEEDED. A record that exists but failed must be
    // reprocessed, since we return 500 to make Stripe retry it.
    const priorSuccess = await WebhookEvent.findOne({ stripeEventId: event.id, success: true });
    if (priorSuccess) {
        logger.info(`Duplicate event ${event.id} (${event.type}) — already processed, skipping`);
        return res.status(200).json({ received: true, duplicate: true });
    }

    // Upsert so a Stripe retry of a previously-failed event reuses the same record
    // rather than colliding with the unique stripeEventId constraint.
    const webhookRecord = await WebhookEvent.findOneAndUpdate(
        { stripeEventId: event.id },
        { $set: { type: event.type, processedAt: new Date() } },
        { upsert: true, new: true }
    );
    if (!webhookRecord) throw new ApiError(500, 'Failed to persist webhook event record');

    try {
        switch (event.type) {
            case 'checkout.session.completed': {
                const session = event.data.object as Stripe.Checkout.Session;
                // For synchronous methods (cards) this is already `paid`. For async
                // methods (bank debits) it's `unpaid` here and settles later via
                // async_payment_succeeded, so we don't fulfill until that arrives.
                if (session.payment_status === 'paid') {
                    await handleSuccessfulPayment(session);
                } else {
                    logger.info(`Session ${session.id} completed but payment_status=${session.payment_status}; awaiting async settlement`);
                }
                break;
            }
            case 'checkout.session.async_payment_succeeded': {
                await handleSuccessfulPayment(event.data.object as Stripe.Checkout.Session);
                break;
            }
            case 'checkout.session.async_payment_failed': {
                const session = event.data.object as Stripe.Checkout.Session;
                await handleFailedPayment(
                    session.client_reference_id ?? session.metadata?.quoteRef,
                    'async payment failed'
                );
                break;
            }
            case 'checkout.session.expired': {
                await handleExpiredPayment(event.data.object as Stripe.Checkout.Session);
                break;
            }
            case 'payment_intent.payment_failed': {
                const paymentIntent = event.data.object as Stripe.PaymentIntent;
                await handleFailedPayment(
                    paymentIntent.metadata?.quoteRef,
                    paymentIntent.last_payment_error?.message ?? 'payment failed'
                );
                break;
            }
            default:
                // An event we don't handle is still a valid delivery — acknowledge it.
                logger.info(`Unhandled event type: ${event.type}`);
        }

        webhookRecord.success = true;
        await webhookRecord.save();
        res.status(200).json({ received: true });
    } catch (error: any) {
        logger.error('Webhook processing error:', error);
        webhookRecord.success = false;
        webhookRecord.error = error.message;
        await webhookRecord.save();
        // 500 so Stripe retries — a 200 here would silently drop the event.
        res.status(500).json({ error: 'Webhook processing failed', message: error.message });
    }
});

/**
 * Finalize a completed PayPal capture (PAYMENT.CAPTURE.COMPLETED). Mirrors the Stripe
 * `handleSuccessfulPayment` shape: an atomic, one-way Unpaid→Paid flip keyed on the quote
 * reference (which PayPal echoes back on the capture as `custom_id`), then the shared
 * fulfillment tail. Only the first delivery to win the flip is `fresh`, gating the one-time
 * email; the shipment is created regardless so a retry still fulfills.
 *
 * The atomic flip matters more here than for Stripe: PayPal has TWO success signals — the
 * synchronous capture-on-return AND this webhook — so the conditional update is what stops
 * them double-shipping/double-emailing.
 *
 * Before flipping, the captured amount/currency is verified against the expectation locked
 * at order creation. A mismatch is NOT fulfilled — it's flagged for reconciliation.
 */
const handlePayPalCaptureCompleted = async (resource: any): Promise<void> => {
    const quoteRef: string | undefined = resource?.custom_id;
    if (!quoteRef) {
        logger.error(`PayPal capture ${resource?.id} completed with no custom_id; cannot reconcile`);
        return;
    }

    const captureId: string | undefined = resource?.id;
    const capturedCurrency: string = (resource?.amount?.currency_code ?? 'USD').toUpperCase();
    const capturedAmount: number = fromPayPalAmount(resource?.amount?.value);

    // Load the record first to read the expectation we locked at order-creation time.
    const existing = await Payment.findOne({ quoteReference: quoteRef });
    if (!existing) {
        logger.error(`No payment record for quote ${quoteRef}; cannot fulfill PayPal payment`);
        return;
    }

    // Defense-in-depth: the settled money must match what we committed to. If it doesn't,
    // refuse to auto-fulfill — flag the record (leaving status un-advanced) and alert.
    if (!capturedAmountMatchesExpectation(existing, capturedAmount, capturedCurrency)) {
        logger.error(
            `PayPal capture amount mismatch for quote ${quoteRef}: expected ` +
            `${existing.expectedAmount} ${existing.expectedCurrency}, captured ` +
            `${capturedAmount} ${capturedCurrency} (capture ${captureId}). ` +
            `Not fulfilling — flagged for manual reconciliation.`
        );
        // Record what actually settled for the reviewer, but only while not already Paid
        // (never clobber a legitimately completed payment).
        await Payment.findOneAndUpdate(
            { quoteReference: quoteRef, status: { $ne: PaymentStatus.Paid } },
            {
                amountMismatch: true,
                amountPaid: capturedAmount,
                currency: capturedCurrency,
                paypalCaptureId: captureId,
            }
        );
        return;
    }

    const fresh = await Payment.findOneAndUpdate(
        { quoteReference: quoteRef, status: { $ne: PaymentStatus.Paid } },
        {
            status: PaymentStatus.Paid,
            provider: PaymentProvider.Paypal,
            paidAt: new Date(),
            amountPaid: capturedAmount,
            currency: capturedCurrency,
            paypalCaptureId: captureId,
        },
        { new: true }
    );

    // On a retry after the flip already happened (fresh === null) the record is already
    // Paid; reuse the copy we loaded so fulfillment stays idempotently correct.
    const payment = fresh ?? existing;
    await fulfillPaidPayment(payment, Boolean(fresh), quoteRef, capturedAmount, capturedCurrency);
};

/**
 * @desc    PayPal capture-on-return — the buyer is redirected here after approving on
 *          PayPal's hosted page. Captures the order and bounces the browser to the
 *          frontend success/cancel page.
 * @route   GET /api/payment/paypal/return
 * @access  Public (the buyer arrives via PayPal's redirect, not our auth layer)
 *
 * This is a UX convenience only, NOT proof of payment — exactly like the Stripe success
 * redirect. We capture here so the buyer isn't left waiting, but fulfillment (Paid flip +
 * shipment + email) is driven solely by the PAYMENT.CAPTURE.COMPLETED webhook, which is the
 * single source of truth. A double return hit (back button + reload) resolves gracefully:
 * `capturePayPalOrder` swallows PayPal's ORDER_ALREADY_CAPTURED and still reports success.
 */
export const paypalReturn = catchAsync(async (req: Request, res: Response) => {
    const frontendUrl = process.env.FRONTEND_URL as string;
    // PayPal appends `?token=<orderId>` (plus PayerID) to the return URL; we also carry quoteRef.
    const orderId = (req.query.token as string) || undefined;
    const quoteRef = (req.query.quoteRef as string) || undefined;
    const cancelUrl = `${frontendUrl}/payment/cancel${quoteRef ? `?quoteRef=${quoteRef}` : ''}`;

    if (!orderId) return res.redirect(cancelUrl);

    try {
        const captured = await capturePayPalOrder(orderId);
        const settled = captured.status === OrderStatus.Completed || captured.alreadyCaptured;
        if (settled) {
            return res.redirect(`${frontendUrl}/payment/success?quoteRef=${quoteRef ?? captured.quoteReference ?? ''}`);
        }
        logger.warn(`PayPal order ${orderId} returned status ${captured.status}; sending buyer to cancel page`);
        return res.redirect(cancelUrl);
    } catch (err: any) {
        logger.error(`PayPal capture-on-return failed for order ${orderId}: ${err?.message ?? err}`);
        return res.redirect(cancelUrl);
    }
});

/**
 * @desc    PayPal webhook — the trustworthy signal that a PayPal payment completed
 * @route   POST /paypal/webhook
 * @access  Public (authenticated by PayPal signature verification, not by our auth layer)
 *
 * Unlike the Stripe route (raw body + local HMAC), this route is mounted AFTER the JSON
 * parser: PayPal verification is REMOTE and needs the parsed event body (see
 * services/paypal/webhook). Same event-level idempotency + audit contract as Stripe,
 * reusing the WebhookEvent collection (event id stored in `stripeEventId`, the globally
 * unique key; `provider` marks it as PayPal for auditing).
 */
export const paypalWebhook = catchAsync(async (req: Request, res: Response) => {
    const event = req.body as any;
    const headers = extractPayPalHeaders(req.headers);

    // Verify by asking PayPal. A failed verification is an unauthenticated request, not a
    // processing failure — 400 so PayPal does not retry (mirrors the Stripe bad-signature path).
    const verified = await verifyPayPalWebhook(headers, event);
    if (!verified) {
        logger.warn(`PayPal webhook signature verification failed for event ${event?.id}`);
        return res.sendStatus(400);
    }

    const eventId: string | undefined = event?.id;
    const eventType: string | undefined = event?.event_type;
    if (!eventId || !eventType) {
        logger.warn('PayPal webhook missing id or event_type; acknowledging without processing');
        return res.sendStatus(200);
    }

    // Event-level idempotency guard shared with Stripe. Skip only if a PRIOR delivery
    // already SUCCEEDED; a record that exists but failed must be reprocessed.
    const priorSuccess = await WebhookEvent.findOne({ stripeEventId: eventId, success: true });
    if (priorSuccess) {
        logger.info(`Duplicate PayPal event ${eventId} (${eventType}) — already processed, skipping`);
        return res.status(200).json({ received: true, duplicate: true });
    }

    const webhookRecord = await WebhookEvent.findOneAndUpdate(
        { stripeEventId: eventId },
        { $set: { type: eventType, provider: PaymentProvider.Paypal, processedAt: new Date() } },
        { upsert: true, new: true }
    );
    if (!webhookRecord) throw new ApiError(500, 'Failed to persist webhook event record');

    try {
        const resource = event?.resource;
        switch (eventType) {
            case PayPalWebhookEvent.CaptureCompleted: {
                await handlePayPalCaptureCompleted(resource);
                break;
            }
            case PayPalWebhookEvent.CaptureDenied: {
                await handleFailedPayment(resource?.custom_id, 'PayPal capture denied');
                break;
            }
            case PayPalWebhookEvent.OrderApproved: {
                // Buyer approved but capture hasn't completed. Not a paid signal — logged
                // for abandonment visibility (a buyer who approves but never settles).
                const ref = resource?.purchase_units?.[0]?.custom_id ?? resource?.id;
                logger.info(`PayPal order approved (awaiting capture) for ${ref}`);
                break;
            }
            default:
                logger.info(`Unhandled PayPal event type: ${eventType}`);
        }

        webhookRecord.success = true;
        await webhookRecord.save();
        res.status(200).json({ received: true });
    } catch (error: any) {
        logger.error('PayPal webhook processing error:', error);
        webhookRecord.success = false;
        webhookRecord.error = error.message;
        await webhookRecord.save();
        // 500 so PayPal retries — a 200 here would silently drop the event.
        res.status(500).json({ error: 'Webhook processing failed', message: error.message });
    }
});

export const getPayments = catchAsync(
    async (req: Request, res: Response) => {
        const {
            status,
            search,
            startDate,
            endDate,
            page = 1,
            limit = 10,
            customer,
        } = req.query;

        // Build filter
        const filter: any = {};

        if (status) {
            filter.status = status;
        }

        if (search) {
            // Escape regex metacharacters so a stray '.' or '(' in the query can't
            // break the pattern or be abused. Search only the fields that actually
            // live on the Payment document (customer/vehicle fields live on the
            // QuoteRequest, two refs away, and would need an aggregation to reach).
            const term = String(search).trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            filter.$or = [
                { quoteReference: { $regex: term, $options: 'i' } },
                { stripeSessionId: { $regex: term, $options: 'i' } },
                { stripePaymentIntentId: { $regex: term, $options: 'i' } },
                { paypalOrderId: { $regex: term, $options: 'i' } },
                { paypalCaptureId: { $regex: term, $options: 'i' } },
            ];
        }

        if (startDate || endDate) {
            filter.createdAt = {};
            if (startDate) filter.createdAt.$gte = new Date(startDate as string);
            if (endDate) filter.createdAt.$lte = new Date(endDate as string);
        }

        if (customer) {
            filter.createdBy = customer
        }

        // Pagination
        const pageNum: number = Number.parseInt(page as string, 10);
        const limitNum: number = Number.parseInt(limit as string, 10);
        const skip: number = (pageNum - 1) * limitNum;

        // Get total count
        const total = await Payment.countDocuments(filter);

        // Get requests
        const payments: IPayment[] | [] = await Payment.find(filter)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limitNum);

        res.status(200).json({
            success: true,
            data: {
                payments,
                pagination: {
                    page: pageNum,
                    limit: limitNum,
                    total,
                    pages: Math.ceil(total / limitNum),
                },
            },
        });
    }
);

/**
 * @desc    Get one payment by its internal id
 * @route   GET /api/payment/:id
 * @access  Admin/SuperAdmin (any payment) or the owning Customer (their own only)
 *
 * Ownership is enforced against the SAME source of truth `create` uses — the
 * QuoteRequest the quote was generated from (`quoteRequestId.user`) — so there's
 * one consistent definition of "owner" across the payment code. Without this,
 * any authenticated user could read another customer's payment (and the populated
 * createdBy name/email) simply by iterating ids.
 */
export const getPaymentById = catchAsync(async (req: Request, res: Response) => {
    const { id } = req.params;

    const payment: IPayment | null = await Payment.findOne({ _id: id }).populate(
        'createdBy',
        'firstName lastName email'
    );

    if (!payment) throw new ApiError(404, 'Payment not found');

    // Admins can view any payment; a customer may only view their own.
    const isAdmin =
        req.user?.role === UserType.Admin || req.user?.role === UserType.SuperAdmin;
    if (!isAdmin) {
        const quote = await Quote.findById(payment.quoteId).populate('quoteRequestId');
        const request = quote?.quoteRequestId as any;
        if (!request?.user || request.user.toString() !== req.user?._id.toString()) {
            throw new ApiError(403, 'You are not authorized to view this payment');
        }
    }

    res.status(200).json({
        success: true,
        data: {
            payment
        },
    });
})

/**
 * @desc    Public payment-status lookup by quote reference (item 12)
 * @route   GET /api/payment/status/:reference
 * @access  Public (rate-limited) — customers in this flow may not have an account
 *
 * Looks up by the human-readable quote reference, NOT the internal _id, and returns
 * only non-sensitive fields so it's safe to expose without authentication.
 */
export const getPaymentStatusByReference = catchAsync(async (req: Request, res: Response) => {
    const { reference } = req.params;

    const payment: IPayment | null = await Payment.findOne({ quoteReference: reference })
        .select('quoteReference status amountPaid currency paidAt');

    if (!payment) throw new ApiError(404, 'Payment not found');

    res.status(200).json({
        success: true,
        data: {
            quoteReference: payment.quoteReference,
            status: payment.status,
            amount: payment.amountPaid,
            currency: payment.currency,
            paidAt: payment.paidAt
        }
    });
});