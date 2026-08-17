import { Request, Response } from 'express';
import { catchAsync } from "../../../../utils/catchAsync";
import Stripe from 'stripe';
import { ApiError } from '../../../../utils/ApiError';
import { stripe } from '../../../../services/payment/stripe';
import logger from '../../../../utils/logger';
import WebhookEvent from '../../../../models/WebhookEvent.model';
import { handleExpiredPayment, handleFailedPayment, handleSuccessfulPayment } from './util';


/**
 * @desc    Stripe webhook — the only trustworthy signal that a payment completed
 * @route   POST /stripe/webhook
 * @access  Public (authenticated by Stripe signature, not by our auth layer)
 */
export const StripeWebhookController = catchAsync(async (req: Request, res: Response) => {
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