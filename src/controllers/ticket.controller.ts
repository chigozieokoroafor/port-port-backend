import { ITicket } from "../models/interfaces/Ticket.interface";
import Ticket from "../models/Ticket.model";
import { ApiError } from "../utils/ApiError";
import { catchAsync } from "../utils/catchAsync";
import {Request, Response} from "express";

export const create = catchAsync(async (req: Request, res: Response) =>{
    const {quoteId, shipmentId} = req.body;
    let ticket: ITicket | null;
    if(quoteId){
        ticket = await Ticket.findOne({
            quote: quoteId
        })
    }else
    {
        ticket = await Ticket.findOne({
            shipment: shipmentId
        });
    }

    if(ticket){
        throw new ApiError(400, 'Ticket already exists');
    }

    await Ticket.create({...req.body});

    return res.status(200).json({
        message: 'Ticket created successfully',
        ticket
    })
})

export const getTicketByReference = catchAsync(async (req: Request, res: Response) =>{
     const {quoteId, shipmentId} = req.query;
     let ticket: ITicket | null;
      if(quoteId){
        ticket = await Ticket.findOne({
            quote: quoteId
        })
    }else
    {
        ticket = await Ticket.findOne({
            shipment: shipmentId
        });
    }

    return res.status(200).json({
        message: 'ticket retrieved successfully',
        ticket
    })

});

export const getTicketById = catchAsync(async(req: Request, res: Response) => {
    const {id} = req.params;

    const ticket = await Ticket.findById(id);
    if(!ticket) throw new ApiError(400, 'Ticket not found');

    return res.status(200).json({
        message: 'Ticket retrieved successfully',
        ticket
    })
});

export const addConversation = catchAsync(async(req: Request, res: Response) =>{
    const {ticketId, conversation} = req.body;

    const ticket: ITicket | null = await Ticket.findById(ticketId);

    if(!ticket) throw new ApiError(400, 'Ticket not found');
    conversation.sentAt = new Date();

    ticket.conversation.push(conversation);

    ticket.save();

    return res.status(200).json({
        message: 'Message sent successfully'
    });
});

export const getTickets = catchAsync(async (req: Request, res: Response) =>{
const {
            status,
            search,
            startDate,
            endDate,
            closedBy,
            page = 1,
            limit = 10,
            customer
        } = req.query;

        // Build filter
        const filter: any = {};

        if (status) {
            filter.status = status;
        }

        if (search) {
            filter.$or = [
                { subject: { $regex: search, $options: 'i' } },
                // { 'customer.fullName': { $regex: search, $options: 'i' } },
                // { 'customer.email': { $regex: search, $options: 'i' } },
                // { 'vehicle.vin': { $regex: search, $options: 'i' } },
            ];
        }

        if (startDate || endDate) {
            filter.createdAt = {};
            if (startDate) filter.createdAt.$gte = new Date(startDate as string);
            if (endDate) filter.createdAt.$lte = new Date(endDate as string);
        }

        if (closedBy) {
            filter.closedBy = closedBy;
        }

        if(customer){
            filter.user = customer;
        }

        // Pagination
        const pageNum: number = Number.parseInt(page as string, 10);
        const limitNum: number = Number.parseInt(limit as string, 10);
        const skip: number = (pageNum - 1) * limitNum;

        // Get total count
        const total = await Ticket.countDocuments(filter);

        // Get requests
        const requests: ITicket[] | null = await Ticket.find(filter)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limitNum);

        res.status(200).json({
            success: true,
            data: {
                requests,
                pagination: {
                    page: pageNum,
                    limit: limitNum,
                    total,
                    pages: Math.ceil(total / limitNum),
                },
            },
        });

});

