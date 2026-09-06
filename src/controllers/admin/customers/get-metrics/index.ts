import { Request, Response } from 'express';
import { catchAsync } from "../../../../utils/catchAsync";
import { getCustomerMetricsAction } from "./util";

export const getCustomerMetricsController = catchAsync(async (req: Request, res: Response) => {
    const metrics = await getCustomerMetricsAction();

    res.status(200).json({
        success: true,
        message: 'Customer metrics fetched successfully',
        data: metrics
    });
});
