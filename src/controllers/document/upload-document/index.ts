import { Request, Response } from 'express';
import { catchAsync } from '../../../utils/catchAsync';
import { ApiError } from '../../../utils/ApiError';
import {
  UploadDocumentDTO,
  uploadDocumentAction,
  validateDTO,
  removeLocalFile,
} from './util';

export const uploadDocumentController = catchAsync(
  async (req: Request, res: Response) => {
    const file = req.file;

    if (!file) {
      throw new ApiError(400, 'File is required');
    }
    
    const userId = req.user?._id?.toString() || (req.user as any)?.id;
    if (!userId) {
      await removeLocalFile(file.path);
      throw new ApiError(401, 'Unauthorized');
    }

    let validatedBody;
    try {
      validatedBody = await validateDTO(req.body, UploadDocumentDTO);
    } catch (error: any) {
      await removeLocalFile(file.path);
      throw new ApiError(400, error.errors?.[0] || 'Invalid request body');
    }

    const document = await uploadDocumentAction(validatedBody, file, userId);

    res.status(201).json({
      success: true,
      message: 'Document uploaded successfully',
      data: document,
    });
  }
);
