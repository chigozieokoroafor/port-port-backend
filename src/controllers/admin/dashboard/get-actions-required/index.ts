import { Request, Response } from 'express';
import { catchAsync } from '../../../../utils/catchAsync';
import { getAdminActionsRequiredAction } from './util';

export const getAdminActionsRequiredController = catchAsync(async (_req: Request, res: Response) => {
    const actions = await getAdminActionsRequiredAction();

    res.status(200).json({
        success: true,
        message: 'Actions required fetched successfully',
        data: actions
    });
});
