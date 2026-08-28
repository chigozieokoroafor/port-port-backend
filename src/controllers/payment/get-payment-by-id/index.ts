import { Request, Response } from 'express';
import { catchAsync } from "../../../utils/catchAsync";
import Payment from '../../../models/Payment.model';
import { IPayment } from '../../../models/interfaces/Payment.interface';
import { ApiError } from '../../../utils/ApiError';
import Quote, { IQuote } from '../../../models/Quote.model';
import { UserType } from '../../../models/enums/UserType.enum';


/**
 * @desc    Get one payment by its internal id
 * @route   GET /api/payment/:id
 * @access  Admin/SuperAdmin (any payment) or the owning Customer (their own only)
 *
 * Ownership is enforced against the SAME source of truth `create` uses — the
 * QuoteRequest the quote was generated from (`quoteRequestId.user`) — so there's
 * one consistent definition of "owner" across the payment code. Without this,
 * any authenticated user could read another customer's payment (and the populated
 * createdBy name/email) simply by iterating ids.
 */
export const getPaymentById = catchAsync(async (req: Request, res: Response) => {
    const { id } = req.params;

    const payment: IPayment | null = await Payment.findOne({ _id: id }).populate(
        'createdBy',
        'firstName lastName email'
    );

    if (!payment) throw new ApiError(404, 'Payment not found');

    // Admins can view any payment; a customer may only view their own.
    const isAdmin =
        req.user?.role === UserType.Admin || req.user?.role === UserType.SuperAdmin;
    if (!isAdmin) {
        const quote = await Quote.findById(payment.quoteId).populate('quoteRequestId');
        const request = quote?.quoteRequestId as any;
        if (!request?.user || request.user.toString() !== req.user?._id.toString()) {
            throw new ApiError(403, 'You are not authorized to view this payment');
        }
    }

    res.status(200).json({
        success: true,
        data: {
            payment
        },
    });
})