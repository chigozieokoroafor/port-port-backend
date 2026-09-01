import { Request, Response } from 'express';
import { catchAsync } from '../../../../utils/catchAsync';
import { getAdminQuoteMetricsAction } from './util';

export const getAdminQuoteMetricsController = catchAsync(async (req: Request, res: Response) => {
    const metrics = await getAdminQuoteMetricsAction();

    res.status(200).json({
        success: true,
        data: metrics
    });
});
