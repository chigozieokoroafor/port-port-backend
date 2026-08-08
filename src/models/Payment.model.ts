import mongoose, { Document, Schema } from 'mongoose';
import { IPayment } from './interfaces/Payment.interface';
import { PaymentStatus } from './enums/PaymentStatus.enum';

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
    paidAt: Date,
    amountPaid: Number,
    currency: String,  // Item 5: store which currency was paid
    stripeSessionId: String,  // Item 6: Stripe's session ID for refunds/disputes
    stripePaymentIntentId: String,  // Item 6: Stripe's payment intent ID
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