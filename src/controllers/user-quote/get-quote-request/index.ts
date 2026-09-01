import { Request, Response } from 'express';
import { catchAsync } from '../../../utils/catchAsync';
import { ApiError } from '../../../utils/ApiError';
import { getQuoteRequestAction } from './util';

export const getQuoteRequestController = catchAsync(async (req: Request, res: Response) => {
    const { id } = req.params;
    const userId = req.user?._id?.toString() //|| req.user?.id;

    if (!userId) {
        throw new ApiError(401, 'Unauthorized');
    }

    const quoteRequest = await getQuoteRequestAction(id, userId);

    if (!quoteRequest) {
        throw new ApiError(404, 'Quote request not found or you do not have permission to view it');
    }

    res.status(200).json({
        success: true,
        data: quoteRequest
    });
});
