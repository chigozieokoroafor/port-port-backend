import { Request, Response } from 'express';
import { catchAsync } from '../../../../utils/catchAsync';
import { ApiError } from '../../../../utils/ApiError';
import { getQuoteRequestAdminAction } from './util';

export const getQuoteRequestAdminController = catchAsync(async (req: Request, res: Response) => {
    const { id } = req.params;

    const quoteRequest = await getQuoteRequestAdminAction(id);

    if (!quoteRequest) {
        throw new ApiError(404, 'Quote request not found');
    }

    res.status(200).json({
        success: true,
        data: quoteRequest
    });
});
