
import { Request, Response } from 'express';
import { catchAsync } from "../../../utils/catchAsync";
import Payment from '../../../models/Payment.model';
import { PaymentStatus } from '../../../models/enums/PaymentStatus.enum';
import { PaymentProvider } from '../../../models/enums/PaymentProvider.enum';
import { PaymentMethod } from '../../../models/enums/PaymentMethod.enum';
import { IPayment } from '../../../models/interfaces/Payment.interface';
import { ApiError } from '../../../utils/ApiError';
import Quote, { IQuote } from '../../../models/Quote.model';
import { createCheckoutSession } from '../../../services/payment';
import { stripe } from '../../../services/payment/stripe';
import { Status } from '../../../models/enums/Status.enum';
import logger from '../../../utils/logger';
import { createPayPalPayment } from './util';

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
export const CreatePaymentController = catchAsync(async (req: Request, res: Response) => {
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

