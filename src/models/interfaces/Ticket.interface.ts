import mongoose, { Document } from "mongoose";
import { TicketStatus } from "../enums/TicketStatus.enum";

export interface ITicket extends Document{
    user: mongoose.Types.ObjectId;
    closedBy: mongoose.Types.ObjectId;
    quote?: mongoose.Types.ObjectId;
    shipment?: mongoose.Types.ObjectId;
    subject: String;
    status: TicketStatus;
    conversation: IConversation[];
    createdAt: Date;
    updatedAt: Date;
    closedAt: Date;
}

interface IConversation{
    user: mongoose.Types.ObjectId;
    text: String;
    sentAt: Date;
}