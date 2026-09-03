import mongoose, { Document } from 'mongoose';
import { ShipmentStatus } from '../enums/ShipmentStatus.enum';

export interface IShipment extends Document {
    quote: mongoose.Types.ObjectId,
    payment: mongoose.Types.ObjectId,
    status: string;
    updatedBy?: mongoose.Types.ObjectId | string;
    isManual?: boolean;
    user?: mongoose.Types.ObjectId | string;
    sku?: string;
    createdAt?: Date;
    updatedAt: Date;
}