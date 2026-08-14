import mongoose, { Document, Schema } from 'mongoose';
import { IPayment } from './interfaces/Payment.interface';
import { PaymentStatus } from './enums/PaymentStatus.enum';
import { PaymentProvider } from './enums/PaymentProvider.enum';

const paymentSchema = new Schema<IPayment>({
    quoteId: {
        type: Schema.Types.ObjectId,
        ref:'Quote',
        required: true,
        index: true
    },
    quoteReference: {
        type: String,
        unique: true,  // Item 9b: prevent race conditions on duplicate link generation
        sparse: true   // Allow nulls for backward compat, but enforce uniqueness when present
    },
    // Which provider fulfilled this payment. Defaults to Stripe so every record
    // written before PayPal existed reads back correctly with no backfill.
    provider: {
        type: String,
        enum: PaymentProvider,
        default: PaymentProvider.Stripe,
        index: true
    },
    paidAt: Date,
    amountPaid: Number,
    currency: String,  // Item 5: store which currency was paid
    // The amount + currency we committed to when the order/session was created, captured
    // up front so webhook fulfillment can confirm the settled money matches. A divergence
    // means something anomalous (partial capture, mutated quote, provider bug) — we refuse
    // to auto-fulfill. Set for PayPal today; Stripe can adopt the same guard.
    expectedAmount: Number,
    expectedCurrency: String,
    // Set true when a confirmed capture's amount/currency did not match the expectation.
    // The payment is left flagged (status not advanced to Paid) for manual reconciliation.
    amountMismatch: Boolean,
    stripeSessionId: String,  // Item 6: Stripe's session ID for refunds/disputes
    stripePaymentIntentId: String,  // Item 6: Stripe's payment intent ID
    // PayPal equivalents of the two stripe* ids above. Order id is the checkout
    // handle (created up front); capture id is the settled-money handle (set on
    // PAYMENT.CAPTURE.COMPLETED) used for refunds/disputes. Sparse: only PayPal rows have them.
    paypalOrderId: {
        type: String,
        index: true,
        sparse: true
    },
    paypalCaptureId: String,
    status: {
        type: String,
        enum: PaymentStatus,
        default: PaymentStatus.Unpaid
    },
    paymentUrl: String,
    createdBy: {
        type: Schema.Types.ObjectId,
        ref:'User',
    },
    updatedBy:{
         type: Schema.Types.ObjectId,
        ref:'User',
    }
},

{
    timestamps: true
})

const Payment = mongoose.model<IPayment>('Payment', paymentSchema);

export default Payment;