import { Request, Response } from 'express';
import { catchAsync } from '../../../../utils/catchAsync';
import { ApiError } from '../../../../utils/ApiError';
import {
    getAdminRecentActivityAction,
    ListRecentActivityDTO,
    validateDTO
} from './util';

export const getAdminRecentActivityController = catchAsync(async (req: Request, res: Response) => {
    let validatedQuery;
    try {
        validatedQuery = await validateDTO(req.query, ListRecentActivityDTO);
    } catch (error: any) {
        throw new ApiError(400, error.errors?.[0] || 'Invalid pagination query');
    }

    const { activities, meta } = await getAdminRecentActivityAction(validatedQuery);

    res.status(200).json({
        success: true,
        data: activities,
        meta
    });
});
