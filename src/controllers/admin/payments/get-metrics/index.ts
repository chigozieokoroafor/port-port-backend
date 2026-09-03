import { Request, Response } from 'express';
import { catchAsync } from "../../../../utils/catchAsync";
import { getPaymentMetricsAction } from "./util";

export const getPaymentMetricsController = catchAsync(async (req: Request, res: Response) => {
    const metrics = await getPaymentMetricsAction();

    res.status(200).json({
        success: true,
        message: 'Payment metrics fetched successfully',
        data: metrics
    });
});
