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
    quoteReference: String,
    paidAt: Date,
    amountPaid: Number,
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