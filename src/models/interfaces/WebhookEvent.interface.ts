import { Document } from "mongoose";
import { PaymentProvider } from "../enums/PaymentProvider.enum";

export interface IWebhookEvent extends Document {
    stripeEventId: string;
    provider: PaymentProvider;
    type: string;
    success: boolean;
    error?: string;
    processedAt: Date;
    createdAt: Date;
    updatedAt: Date;
}
