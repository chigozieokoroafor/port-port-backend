import { Request, Response } from 'express';
import { catchAsync } from "../../../../utils/catchAsync";
import { getCustomerProfileAction } from "./util";

export const getCustomerProfileController = catchAsync(async (req: Request, res: Response) => {
    const { id } = req.params;
    const profile = await getCustomerProfileAction(id);

    res.status(200).json({
        success: true,
        message: 'Customer profile fetched successfully',
        data: profile
    });
});
