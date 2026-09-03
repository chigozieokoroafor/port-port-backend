import { Request, Response } from 'express';
import { catchAsync } from '../../../../utils/catchAsync';
import { ApiError } from '../../../../utils/ApiError';
import { getListAdminShipmentsAction, ListAdminShipmentsDTO, validateDTO } from './util';

export const listAdminShipmentsController = catchAsync(async (req: Request, res: Response) => {
    let validatedQuery;
    try {
        validatedQuery = await validateDTO(req.query, ListAdminShipmentsDTO);
    } catch (error: any) {
        throw new ApiError(400, error.errors?.[0] || 'Invalid pagination query');
    }

    const { shipments, meta } = await getListAdminShipmentsAction(validatedQuery);

    res.status(200).json({
        success: true,
        data: shipments,
        meta
    });
});
