import { Request, Response } from 'express';
import { catchAsync } from '../../../utils/catchAsync';
import { ApiError } from '../../../utils/ApiError';
import { getListUserPaymentsAction, ListUserPaymentsDTO, validateDTO } from './util';

export const listUserPaymentsController = catchAsync(async (req: Request, res: Response) => {
    const { userId: requestedUserId } = req.params;
    const userId = req.user?._id?.toString() //|| req.user?.id;

    if (userId !== requestedUserId) {
        throw new ApiError(403, 'You are not authorized to view this user\'s payments');
    }

    let validatedQuery;
    try {
        validatedQuery = await validateDTO(req.query, ListUserPaymentsDTO);
    } catch (error: any) {
        throw new ApiError(400, error.errors?.[0] || 'Invalid pagination query');
    }

    const { payments, meta } = await getListUserPaymentsAction(userId, validatedQuery);

    res.status(200).json({
        success: true,
        data: payments,
        meta
    });
});
