import { Request, Response } from 'express';
import { catchAsync } from "../../../../utils/catchAsync";
import { getShipmentMetricsAction } from "./util";

export const getShipmentMetricsController = catchAsync(async (req: Request, res: Response) => {
    const metrics = await getShipmentMetricsAction();

    res.status(200).json({
        success: true,
        message: 'Shipment metrics fetched successfully',
        data: metrics
    });
});
