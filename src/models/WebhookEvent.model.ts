import mongoose, { Schema } from 'mongoose';
import { IWebhookEvent } from './interfaces/WebhookEvent.interface';

const webhookEventSchema = new Schema<IWebhookEvent>({
    stripeEventId: {
        type: String,
        required: true,
        unique: true,  // Item 14 + 9a: doubles as the event-level idempotency guard
        index: true
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
