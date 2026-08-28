import { Request, Response } from 'express';
import { catchAsync } from "../../../utils/catchAsync";
import Payment from '../../../models/Payment.model';
import { IPayment } from '../../../models/interfaces/Payment.interface';

export const getPayments = catchAsync(
    async (req: Request, res: Response) => {
        const {
            status,
            search,
            startDate,
            endDate,
            page = 1,
            limit = 10,
            customer,
        } = req.query;

        // Build filter
        const filter: any = {};

        if (status) {
            filter.status = status;
        }

        if (search) {
            // Escape regex metacharacters so a stray '.' or '(' in the query can't
            // break the pattern or be abused. Search only the fields that actually
            // live on the Payment document (customer/vehicle fields live on the
            // QuoteRequest, two refs away, and would need an aggregation to reach).
            const term = String(search).trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            filter.$or = [
                { quoteReference: { $regex: term, $options: 'i' } },
                { stripeSessionId: { $regex: term, $options: 'i' } },
                { stripePaymentIntentId: { $regex: term, $options: 'i' } },
                { paypalOrderId: { $regex: term, $options: 'i' } },
                { paypalCaptureId: { $regex: term, $options: 'i' } },
            ];
        }

        if (startDate || endDate) {
            filter.createdAt = {};
            if (startDate) filter.createdAt.$gte = new Date(startDate as string);
            if (endDate) filter.createdAt.$lte = new Date(endDate as string);
        }

        if (customer) {
            filter.createdBy = customer
        }

        // Pagination
        const pageNum: number = Number.parseInt(page as string, 10);
        const limitNum: number = Number.parseInt(limit as string, 10);
        const skip: number = (pageNum - 1) * limitNum;

        // Get total count
        const total = await Payment.countDocuments(filter);

        // Get requests
        const payments: IPayment[] | [] = await Payment.find(filter)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limitNum);

        res.status(200).json({
            success: true,
            data: {
                payments,
                pagination: {
                    page: pageNum,
                    limit: limitNum,
                    total,
                    pages: Math.ceil(total / limitNum),
                },
            },
        });
    }
);