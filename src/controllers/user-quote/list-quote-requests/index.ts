import { Request, Response } from 'express';
import { catchAsync } from '../../../utils/catchAsync';
import { ApiError } from '../../../utils/ApiError';
import { getUserQuoteRequestsAction, ListUserQuoteRequestsDTO, validateDTO } from './util';

export const listQuoteRequestsController = catchAsync(async (req: Request, res: Response) => {
    const { userId: requestedUserId } = req.params;
    const userId = req.user?._id?.toString() //|| req.user?.id;

    if (userId !== requestedUserId) {
        throw new ApiError(400, 'You cannot view other users quote requests');
    }

    let validatedQuery;
    try {
        validatedQuery = await validateDTO(req.query, ListUserQuoteRequestsDTO);
    } catch (error: any) {
        throw new ApiError(400, error.errors?.[0] || 'Invalid pagination query');
    }

    const quoterequests = await getUserQuoteRequestsAction(userId, validatedQuery);

    res.status(200).json({
        success: true,
        data: quoterequests,

    });
});
