import { Request, Response } from 'express';
import { catchAsync } from '../../../utils/catchAsync';
import { ApiError } from '../../../utils/ApiError';
import { getListUserShipmentsAction, ListUserShipmentsDTO, validateDTO } from './util';

export const listUserShipmentsController = catchAsync(async (req: Request, res: Response) => {
    const { userId: requestedUserId } = req.params;
    const userId = req.user?._id?.toString() //|| req.user?.id;

    if (userId !== requestedUserId) {
        throw new ApiError(403, 'You are not authorized to view this user\'s shipments');
    }

    let validatedQuery;
    try {
        validatedQuery = await validateDTO(req.query, ListUserShipmentsDTO);
    } catch (error: any) {
        throw new ApiError(400, error.errors?.[0] || 'Invalid pagination query');
    }

    console.log("QUERY = ==> ",validatedQuery)

    const { shipments, meta } = await getListUserShipmentsAction(userId, validatedQuery);

    res.status(200).json({
        success: true,
        data: shipments,
        meta
    });
});
