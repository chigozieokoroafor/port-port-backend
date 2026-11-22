import { Request, Response } from 'express';
import { catchAsync } from '../../../../utils/catchAsync';
import { getAdminDashboardMetricsAction } from './util';

export const getAdminDashboardMetricsController = catchAsync(async (_req: Request, res: Response) => {
    const metrics = await getAdminDashboardMetricsAction();

    res.status(200).json({
        success: true,
        message: 'Dashboard metrics fetched successfully',
        data: metrics
    });
});
