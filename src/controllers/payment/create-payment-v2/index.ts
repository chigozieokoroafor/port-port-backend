import { Request, Response } from 'express';
import { catchAsync } from "../../../utils/catchAsync";
import { CreatePaymentDTO, getQuoteByProvidedId, handlePayments } from './util';

export const createPaymentV2Controller = catchAsync(async (req: Request, res: Response) => {
    // Validate request body
    const dto = CreatePaymentDTO.validateSync(req.body);
    
    // Extract userId from the authenticated user if available
    if ((req as any).user) {
        dto.userId = (req as any).user._id || (req as any).user.id;
    }

    const quote = await getQuoteByProvidedId(dto);

    const paymentResponse = await handlePayments(quote, dto);

    return res.status(200).json(paymentResponse);
});
