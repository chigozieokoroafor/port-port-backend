import { Request, Response } from 'express';
import { catchAsync } from "../../../utils/catchAsync";
import { ApiError } from '../../../utils/ApiError';
import { getListAdminPaymentsAction, ListAdminPaymentsDTO, validateDTO } from './util';

export const getPayments = catchAsync(async (req: Request, res: Response) => {
    let validatedQuery;
    try {
        validatedQuery = await validateDTO(req.query, ListAdminPaymentsDTO);
    } catch (error: any) {
        throw new ApiError(400, error.errors?.[0] || 'Invalid pagination query');
    }

    const { payments, meta } = await getListAdminPaymentsAction(validatedQuery);

    res.status(200).json({
        success: true,
        data: payments,
        meta
    });
});