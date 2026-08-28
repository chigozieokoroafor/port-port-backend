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

// One shipment per payment: makes webhook-driven fulfillment idempotent under
// duplicate/retried Stripe deliveries. Partial (not sparse) so it ignores manual
// shipments that carry no payment, while still rejecting a duplicate real payment.
shipmentSchema.index(
    { payment: 1 },
    { unique: true, partialFilterExpression: { payment: { $type: 'objectId' } } }
);

const Shipment = mongoose.model<IShipment>('Shipment', shipmentSchema);

export default Shipment;