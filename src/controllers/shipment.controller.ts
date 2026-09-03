import {Request, Response} from "express";
import { catchAsync } from "../utils/catchAsync";
import Quote from "../models/Quote.model";
import { ApiError } from "../utils/ApiError";
import Shipment from "../models/Shipment.model";

export const create = catchAsync(async (req: Request, res: Response) =>{
    const quote = await Quote.findById(req.body.quoteId).populate('quoteRequestId');
    if(!quote) throw new ApiError(400, 'A valid quote is required');
    
    const quoteRequest = quote.quoteRequestId as any;
    const userId = quoteRequest?.userId || quoteRequest?.user;

    const sku = req.body.sku || `SKU-${Math.floor(Math.random() * 1000000).toString().padStart(6, '0')}`;
    const shipment = await Shipment.create({...req.body, isManual: true, sku, user: userId});

    return res.status(200).json({
        message: 'Shipment created successfully',
        shipment
    })
});



