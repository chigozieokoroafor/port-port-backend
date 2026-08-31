import { Request, Response } from 'express';
import { catchAsync } from '../../../utils/catchAsync';
import { ApiError } from '../../../utils/ApiError';
import { getUserQuoteMetricsAction } from './util';

export const getUserQuoteMetricsController = catchAsync(async (req: Request, res: Response) => {
    const { userId: requestedUserId } = req.params;
    const userId = req.user?._id?.toString() //|| req.user?.id;

    if (userId !== requestedUserId) {
        throw new ApiError(400, 'You cannot view other users quote metrics');
    }

    const metrics = await getUserQuoteMetricsAction(userId);

    res.status(200).json({
        success: true,
        data: metrics
    });
});
