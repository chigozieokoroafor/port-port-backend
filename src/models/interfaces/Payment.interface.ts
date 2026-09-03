import mongoose, {Document} from "mongoose";
import { PaymentStatus } from "../enums/PaymentStatus.enum";
import { PaymentProvider } from "../enums/PaymentProvider.enum";

export interface IPayment extends Document{
    quoteId: mongoose.Types.ObjectId,
    quoteReference: String,
    provider: PaymentProvider;
    status: PaymentStatus,
    paymentUrl: String;
    currency?: string;
    // The amount + currency we locked in when the order/session was created. Stored so
    // webhook fulfillment can verify the settled money matches, and refuse to fulfill if not.
    expectedAmount?: number;
    expectedCurrency?: string;
    // Raised when a confirmed capture's amount/currency did NOT match the expectation above.
    // Such a payment is left flagged (not marked Paid) for manual reconciliation.
    amountMismatch?: boolean;
    stripeSessionId?: string;
    stripePaymentIntentId?: string;
    paypalOrderId?: string;
    paypalCaptureId?: string;
    user?: mongoose.Types.ObjectId | string;
    createdAt: Date;
    updatedAt: Date;
    paidAt: Date;
    amountPaid: Number;
    createdBy: mongoose.Types.ObjectId,
    updatedBy: mongoose.Types.ObjectId
}

