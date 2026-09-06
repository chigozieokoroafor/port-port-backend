import { Request, Response } from 'express';
import { catchAsync } from "../../../utils/catchAsync";
import { getUserShipmentMetricsAction } from "./util";
// import { AuthRequest } from "../../../middleware/auth.middleware";
import { ApiError } from "../../../utils/ApiError";

export const getUserShipmentMetricsController = catchAsync(async (req: Request, res: Response) => {
    const userId = req.params.userId;
    
    // Optional: Ensure the user is requesting their own metrics or is an admin
    // if (req.user?.role !== 'SuperAdmin' && req.user?.role !== 'Admin' && req.user?.id !== userId) {
    //     throw new ApiError(403, 'Forbidden: You can only access your own metrics');
    // }

    const metrics = await getUserShipmentMetricsAction(userId);

    res.status(200).json({
        success: true,
        message: 'User shipment metrics fetched successfully',
        data: metrics
    });
});
