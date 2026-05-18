import mongoose, { Document } from "mongoose";
import { PaymentStatus } from "../enums/PaymentStatus.enum";

export interface IPayment extends Document{
    quoteId: mongoose.Types.ObjectId,
    quoteReference: String,
    status: PaymentStatus,
    paymentUrl: String;
    createdAt: Date;
    updatedAt: Date;
    paidAt: Date;
    amountPaid: Number;
    createdBy: mongoose.Types.ObjectId,
    updatedBy: mongoose.Types.ObjectId
}

