import { Request, Response } from 'express';
import { catchAsync } from '../../../../utils/catchAsync';
import { getAdminDocumentByIdAction } from './util';

export const getAdminDocumentByIdController = catchAsync(async (req: Request, res: Response) => {
    const { id } = req.params;

    const document = await getAdminDocumentByIdAction(id);

    res.status(200).json({
        success: true,
        message: 'Document fetched successfully',
        data: document
    });
});
