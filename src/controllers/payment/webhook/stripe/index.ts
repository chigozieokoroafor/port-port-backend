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


const initialwebhook = {
    id: 'evt_3UAoiRBioCZi9pce1ziXA8kG',
    object: 'event',
    api_version: '2026-07-29.dahlia',
    created: 1788257710,
    data: {
        object: {
            id: 'py_3UAoiRBioCZi9pce1tVcIiCs',
            object: 'charge',
            amount: 221000,
            amount_captured: 221000,
            amount_refunded: 0,
            application: null,
            application_fee: null,
            application_fee_amount: null,
            balance_transaction: 'txn_3UAoiRBioCZi9pce1oIS61yS',
            billing_details: {
                address: {
                    city: null,
                    country: null,
                    line1: null,
                    line2: null,
                    postal_code: null,
                    state: null
                },
                email: 'nobody+56tlll@stripe.com',
                name: 'rando',
                phone: null,
                tax_id: null
            },
            calculated_statement_descriptor: null,
            captured: true,
            created: 1788257696,
            currency: 'usd',
            customer: null,
            description: null,
            destination: null,
            dispute: null,
            disputed: false,
            failure_balance_transaction: null,
            failure_code: null,
            failure_message: null,
            fraud_details: {},
            livemode: false,
            metadata: { quoteRef: 'QT-590740', quoteId: '6a954446d9e82f981aacbddc' },
            on_behalf_of: null,
            order: null,
            outcome: {
                advice_code: null,
                network_advice_code: null,
                network_decline_code: null,
                network_status: 'approved_by_network',
                reason: null,
                risk_level: 'normal',
                risk_score: 7,
                seller_message: 'Payment complete.',
                type: 'authorized'
            },
            paid: true,
            payment_intent: 'pi_3UAoiRBioCZi9pce1jK9mrT1',
            payment_method: 'pm_1UAoiQBioCZi9pceJmP9IskE',
            payment_method_details: {
                type: 'us_bank_account',
                us_bank_account: {
                    account_holder_type: 'individual',
                    account_type: 'checking',
                    bank_name: 'STRIPE TEST BANK',
                    expected_debit_date: '2026-09-01',
                    fingerprint: 'ov0QUt8H0OlCyyoq',
                    last4: '6789',
                    mandate: 'mandate_1UAoiSBioCZi9pceABWHqWrB',
                    payment_reference: 'Kf+dm7eSPzO+DHjm4YhMZZhGZKjoT/raZFiAmqlpB3g=',
                    routing_number: '110000000'
                }
            },
            radar_options: {},
            receipt_email: null,
            receipt_number: null,
            receipt_url: 'https://pay.stripe.com/receipts/payment/CAcaFwoVYWNjdF8xVTJPY2hCaW9DWmk5cGNlKK7L2tQGMgaR1dPv4Ho6LBaFnt7B3n843_u1I6-yV6p6oVLF26_Ty81ymZbbo7wE393CZaoo8gRs4rG6',
            refunded: false,
            review: null,
            shipping: null,
            source: null,
            source_transfer: null,
            statement_descriptor: null,
            statement_descriptor_suffix: null,
            status: 'succeeded',
            transfer_data: null,
            transfer_group: null
        },
        previous_attributes: {
            balance_transaction: null,
            receipt_url: 'https://pay.stripe.com/receipts/payment/CAcaFwoVYWNjdF8xVTJPY2hCaW9DWmk5cGNlKK7L2tQGMgZSNlK-8B06LBauwVSUZ67mdI7BCNanHnv2h9hl57Siu04X7YWQr2vkSntZVFuEiyO3bJyI'
        }
    },
    livemode: false,
    pending_webhooks: 2,
    request: { id: null, idempotency_key: null },
    type: 'charge.updated'
}

export const StripeWebhookController = catchAsync(async (req: Request, res: Response) => {
    let event: Stripe.Event;
    const signature: string | string[] = req.headers['stripe-signature'] || '';

    // console.log("STRIPE_WEBHOOK_SECRET:   ", process.env.STRIPE_WEBHOOK_SECRET)
    // console.dir(req.headers, { depth: 12 })
    // console.log("body============> ")
    // console.dir(req.body, { depth: 12 })

    try {
        // Signature verification needs the exact raw bytes Stripe sent (guide 1.5);
        // this route is mounted with express.raw() before the global JSON parser.
        event = await stripe.webhooks.constructEventAsync(
            // Buffer.from(JSON.stringify(req.body), 'utf8'),
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
    // if (!webhookRecord) throw new ApiError(500, 'Failed to persist webhook event record');

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