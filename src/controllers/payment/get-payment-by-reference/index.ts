import { Request, Response } from 'express';
import { catchAsync } from "../../../utils/catchAsync";
import Payment from '../../../models/Payment.model';
import { IPayment } from '../../../models/interfaces/Payment.interface';
import { ApiError } from '../../../utils/ApiError';
/**
 * @desc    Public payment-status lookup by quote reference (item 12)
 * @route   GET /api/payment/status/:reference
 * @access  Public (rate-limited) — customers in this flow may not have an account
 *
 * Looks up by the human-readable quote reference, NOT the internal _id, and returns
 * only non-sensitive fields so it's safe to expose without authentication.
 */
export const getPaymentStatusByReference = catchAsync(async (req: Request, res: Response) => {
    const { reference } = req.params;

    const payment: IPayment | null = await Payment.findOne({ quoteReference: reference })
        .select('quoteReference status amountPaid currency paidAt');

    if (!payment) throw new ApiError(404, 'Payment not found');

    res.status(200).json({
        success: true,
        data: {
            quoteReference: payment.quoteReference,
            status: payment.status,
            amount: payment.amountPaid,
            currency: payment.currency,
            paidAt: payment.paidAt
        }
    });
});