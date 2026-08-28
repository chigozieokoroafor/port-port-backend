import type { Request, Response } from 'express';
import { catchAsync } from '../../../../utils/catchAsync';
import { ApproveQuoteDTO, approveQuoteAction, TApproveQuoteDTO, validateDTO } from './util';
import { ApiError } from '../../../../utils/ApiError';

/**
 * @desc    Generate pricing quote
 * @route   POST /api/admin/quotes/:requestId/generate
 * @access  Admin
 */
export const approveQuoteController = catchAsync(async (req: Request, res: Response) => {
    const user = (req as any).user;
    if (!user || !user._id) {
        throw new ApiError(401, 'Not authenticated');
    }

    const input = {
        requestId: req.params.requestId,
        ...req.body
    };

    const dto = await validateDTO<TApproveQuoteDTO>(input, ApproveQuoteDTO);

    const quote = await approveQuoteAction(dto, user._id.toString());

    res.status(200).json({
        success: true,
        message: 'Quote generated successfully',
        data: { quote }
    });
});
