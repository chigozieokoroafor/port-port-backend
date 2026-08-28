import { Request, Response } from 'express';
import { catchAsync } from "../../../../utils/catchAsync";
import { extractPayPalHeaders, handlePayPalCaptureCompleted, verifyPayPalWebhook } from './util';
import logger from '../../../../utils/logger';
import WebhookEvent from '../../../../models/WebhookEvent.model';
import { PaymentProvider } from '../../../../models/enums/PaymentProvider.enum';
import { ApiError } from '../../../../utils/ApiError';
import { PayPalWebhookEvent } from '../../../../models/enums/PayPalWebhookEvent.enum';
import { handleFailedPayment } from '../stripe/util';
// import { capturePayPalOrder } from '../../../../services/paypal';
import { OrderStatus } from '@paypal/paypal-server-sdk';
import { capturePayPalOrder } from './util';



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
export const PaypalWebhookController = catchAsync(async (req: Request, res: Response) => {
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

