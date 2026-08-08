import { Document } from "mongoose";

export interface IWebhookEvent extends Document {
    stripeEventId: string;
    type: string;
    success: boolean;
    error?: string;
    processedAt: Date;
    createdAt: Date;
    updatedAt: Date;
}
