import mongoose, { Schema } from 'mongoose';
import { IWebhookEvent } from './interfaces/WebhookEvent.interface';
import { PaymentProvider } from './enums/PaymentProvider.enum';

const webhookEventSchema = new Schema<IWebhookEvent>({
    stripeEventId: {
        type: String,
        required: true,
        unique: true,  // Item 14 + 9a: doubles as the event-level idempotency guard
        index: true
    },
    // Which provider delivered this event. The id field above is globally unique
    // per provider, so it keeps guarding idempotency across both; this just records
    // the source for auditing. Defaults to Stripe for pre-existing rows.
    provider: {
        type: String,
        enum: PaymentProvider,
        default: PaymentProvider.Stripe
    },
    type: {
        type: String,
        required: true
    },
    success: {
        type: Boolean,
        default: false
    },
    error: String,
    processedAt: Date
},
{
    timestamps: true
})

const WebhookEvent = mongoose.model<IWebhookEvent>('WebhookEvent', webhookEventSchema);

export default WebhookEvent;
