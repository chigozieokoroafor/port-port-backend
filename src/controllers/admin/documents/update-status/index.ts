import { Request, Response } from 'express';
import { catchAsync } from '../../../../utils/catchAsync';
import { ApiError } from '../../../../utils/ApiError';
import {
    UpdateDocumentStatusDTO,
    updateDocumentStatusAction,
    validateDTO
} from './util';

export const updateDocumentStatusController = catchAsync(async (req: Request, res: Response) => {
    const { id } = req.params;
    const adminId = req.user?._id?.toString() || (req.user as any)?.id;

    let validatedBody;
    try {
        validatedBody = await validateDTO(req.body, UpdateDocumentStatusDTO);
    } catch (error: any) {
        throw new ApiError(400, error.errors?.[0] || 'Invalid request body');
    }

    const updatedDocument = await updateDocumentStatusAction(id, validatedBody, adminId);

    res.status(200).json({
        success: true,
        message: `Document status updated to ${updatedDocument.status}`,
        data: updatedDocument
    });
});
