import {Request, Response} from "express";
import { catchAsync } from "../utils/catchAsync";
import Quote from "../models/Quote.model";
import { ApiError } from "../utils/ApiError";
import Shipment from "../models/Shipment.model";

export const create = catchAsync(async (req: Request, res: Response) =>{
    const quote = await Quote.findById(req.body.quoteId);
    if(!quote) throw new ApiError(400, 'A valid quote is required');

    const shipment = await Shipment.create({...req.body, isManual: true});

    return res.status(200).json({
        message: 'Shipment created successfully',
        shipment
    })
});



