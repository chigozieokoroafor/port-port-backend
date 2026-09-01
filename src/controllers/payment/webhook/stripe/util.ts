import { Request, Response } from 'express';
import Stripe from 'stripe';
import Payment from '../../../../models/Payment.model';
import { PaymentStatus } from '../../../../models/enums/PaymentStatus.enum';
import { IPayment } from '../../../../models/interfaces/Payment.interface';
import Shipment from '../../../../models/Shipment.model';
import Quote from '../../../../models/Quote.model';
import { fromMinorUnits } from '../../../../services/payment/currency';
import { sendPaymentConfirmationEmail } from '../../../../services/email';
import logger from '../../../../utils/logger';
import { prisma } from '../../../../config/database';



/**
 * Mark a payment as expired when its Checkout Session times out unused.
 *
 * Scoped to THIS exact session (stripeSessionId) and only while the record is
 * still Unpaid, so a stale expiry event can never overwrite a regenerated link
 * (which has a newer session id) or a payment that has since completed.
 */
export const handleExpiredPayment = async (session: Stripe.Checkout.Session): Promise<void> => {
    const quoteRef = session.client_reference_id ?? session.metadata?.quoteRef;
    if (!quoteRef) return;
    await Payment.findOneAndUpdate(
        { quoteReference: quoteRef, stripeSessionId: session.id, status: PaymentStatus.Unpaid },
        { status: PaymentStatus.Expired }
    );
    logger.info(`Session ${session.id} for quote ${quoteRef} expired`);
};

/**
 * Idempotent fulfillment: ensure exactly one Shipment exists for a paid payment.
 * Keyed on the payment id and guarded by the unique sparse index on `Shipment.payment`,
 * so a Stripe webhook retry (or a concurrent duplicate delivery) can't create a second
 * shipment. A concurrent insert that loses the race raises 11000, which we treat as
 * "already fulfilled".
 */
export const ensureShipment = async (payment: IPayment): Promise<void> => {
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
export const fulfillPaidPayment = async (
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
        if (quote) {
            await prisma.quote.update(
                {
                    where: {
                        id: String(payment.quoteId)
                    },
                    data: {
                        status: "Paid"
                    }
                }
            )
            // quote.status = "Paid";
            // await quote?.save();
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
export const capturedAmountMatchesExpectation = (
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
export const handleSuccessfulPayment = async (session: Stripe.Checkout.Session): Promise<void> => {
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
export const handleFailedPayment = async (
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