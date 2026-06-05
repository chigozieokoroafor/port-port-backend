import mongoose, { Schema } from "mongoose";
import { IShipment } from "./interfaces/Shipment.interface";
import { ShipmentStatus } from "./enums/ShipmentStatus.enum";

const shipmentSchema = new Schema<IShipment>({
    quote: {
        type: Schema.Types.ObjectId,
        ref: 'Quote'
    },
    payment: {
        type: Schema.Types.ObjectId,
        ref:'Payment'
    },
    status: {
            type: String,
            enum: ShipmentStatus,
            default: ShipmentStatus.Dock
    },
    updatedBy: {
        type: Schema.Types.ObjectId,
        ref: 'User'
    },
    isManual: {
        type: Boolean,
        default: false
    }
}, 
{
    timestamps: true
})

const Shipment = mongoose.model<IShipment>('Shipment', shipmentSchema);

export default Shipment;