import mongoose, { Document } from 'mongoose';
import { ShipmentStatus } from '../enums/ShipmentStatus.enum';

export interface IShipment extends Document {
    quote: mongoose.Types.ObjectId,
    payment: mongoose.Types.ObjectId,
    status: ShipmentStatus,
    createdAt: Date,
    updatedAt: Date,
    updatedBy: mongoose.Types.ObjectId,
    isManual: Boolean
}