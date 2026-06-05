import mongoose, { Schema } from "mongoose";
import { ITicket } from "./interfaces/Ticket.interface";
import { TicketStatus } from "./enums/TicketStatus.enum";

const ticketSchema = new Schema<ITicket>({
    user: {
        type: Schema.Types.ObjectId,
        ref:'User',
    },
    closedBy: {
        type: Schema.Types.ObjectId,
        ref:'User',
    },
    subject: String,
    status: {
        type: String,
        enum: TicketStatus,
        default: TicketStatus.Open
    },
    quote:{
        type: Schema.Types.ObjectId,
        ref:'Quote',
    },
    shipment:{
         type: Schema.Types.ObjectId,
        ref:'Shipment',
    },
    conversation: {
        user: {
         type: Schema.Types.ObjectId,
        ref:'User',
        },
        text: String,
        sentAt: Date
    },
    closedAt: Date

},

{
    timestamps: true
});

const Ticket = mongoose.model<ITicket>('Ticket', ticketSchema);

export default Ticket;