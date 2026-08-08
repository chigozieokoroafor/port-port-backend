import { Request, Response } from 'express';
import { catchAsync } from "../utils/catchAsync";
import Stripe from 'stripe';
import Payment from '../models/Payment.model';
import { PaymentStatus } from '../models/enums/PaymentStatus.enum';
import { IPayment } from '../models/interfaces/Payment.interface';
import { ApiError } from '../utils/ApiError';
import Shipment from '../models/Shipment.model';
import Quote from '../models/Quote.model';
import { createCheckoutSession } from '../services/payment';
import { stripe } from '../services/payment/stripe';
import { fromMinorUnits } from '../services/payment/currency';
import { sendPaymentConfirmationEmail } from '../services/email';
import { Status } from '../models/enums/Status.enum';
import logger from '../utils/logger';
import WebhookEvent from '../models/WebhookEvent.model';

/**
 * @desc    Create a Stripe Checkout Session for an approved quote
 * @route   POST /api/payment/create
 * @access  Customer (authenticated) — the customer initiates their own checkout
 *
 * Frontend-redirect flow: this returns the hosted checkout URL for the client to
 * redirect the browser to. No email is sent here — the payment confirmation email
 * goes out from the webhook once payment is actually confirmed.
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
                    paymentUrl: session.url,
                    stripeSessionId: session.id,
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

    const fresh = await Payment.findOneAndUpdate(
        { quoteReference: quoteRef, status: { $ne: PaymentStatus.Paid } },
        {
            status: PaymentStatus.Paid,
            paidAt: new Date(),
            amountPaid: session.amount_total,
            currency: session.currency?.toUpperCase(),
            stripeSessionId: session.id,
            stripePaymentIntentId: paymentIntentId,
        },
        { new: true }
    );

    // On a retry after a crash the record may already be Paid (fresh === null); still
    // load it so fulfillment can be made idempotently correct.
    const payment = fresh ?? await Payment.findOne({ quoteReference: quoteRef });
    if (!payment) {
        logger.error(`No payment record for quote ${quoteRef}; cannot fulfill payment`);
        return;
    }

    await ensureShipment(payment);

    // Email only on the fresh transition, so a retry doesn't send a duplicate confirmation.
    if (fresh) {
        try {
            const quote = await Quote.findById(payment.quoteId).populate('quoteRequestId');
            const request = quote?.quoteRequestId as any;
            if (request?.customer?.email) {
                await sendPaymentConfirmationEmail(
                    request.customer.email,
                    request.customer.fullName,
                    fromMinorUnits(session.amount_total ?? 0, session.currency ?? 'USD'),
                    (session.currency ?? 'USD').toUpperCase(),
                    quoteRef,
                    `${process.env.FRONTEND_URL}/receipts/${payment._id}`
                );
            }
        } catch (emailError) {
            logger.error('Failed to send payment confirmation email:', emailError);
            // Continue — payment and shipment are already recorded.
        }
        logger.info(`Quote ${quoteRef} paid successfully`);
    }
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

export const getPaymentById = catchAsync( async (req: Request, res: Response)=>{
    const { id } = req.params;

        // Get associated quote if exists
        const payment: IPayment | null = await Payment.findOne({ _id: id }).populate(
            'createdBy',
            'firstName lastName email'
        );

        res.status(200).json({
            success: true,
            data: {
                payment
            },
        });
    }
)

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