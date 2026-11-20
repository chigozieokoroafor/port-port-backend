import { Request, Response } from 'express';
import { catchAsync } from '../../../utils/catchAsync';
import { ApiError } from '../../../utils/ApiError';
import { getListUserDocumentsAction, ListUserDocumentsDTO, validateDTO } from './util';

export const listUserDocumentsController = catchAsync(async (req: Request, res: Response) => {
    const { userId: requestedUserId } = req.params;

    let validatedQuery;
    try {
        validatedQuery = await validateDTO(req.query, ListUserDocumentsDTO);
    } catch (error: any) {
        throw new ApiError(400, error.errors?.[0] || 'Invalid pagination query');
    }

    const { documents, meta } = await getListUserDocumentsAction(requestedUserId, validatedQuery);

    res.status(200).json({
        success: true,
        data: documents,
        meta
    });
});
