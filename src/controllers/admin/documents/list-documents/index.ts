import { Request, Response } from 'express';
import { catchAsync } from '../../../../utils/catchAsync';
import { ApiError } from '../../../../utils/ApiError';
import { getListAdminDocumentsAction, ListAdminDocumentsDTO, validateDTO } from './util';

export const listAdminDocumentsController = catchAsync(async (req: Request, res: Response) => {
    let validatedQuery;
    try {
        validatedQuery = await validateDTO(req.query, ListAdminDocumentsDTO);
    } catch (error: any) {
        throw new ApiError(400, error.errors?.[0] || 'Invalid pagination query');
    }

    const { documents, meta } = await getListAdminDocumentsAction(validatedQuery);
    
    res.status(200).json({
        success: true,
        data: documents,
        meta
    });
});
