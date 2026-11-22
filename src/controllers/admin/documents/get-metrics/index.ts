import { Request, Response } from 'express';
import { catchAsync } from "../../../../utils/catchAsync";
import { getAdminDocumentMetricsAction } from "./util";

export const getAdminDocumentMetricsController = catchAsync(async (_req: Request, res: Response) => {
    const metrics = await getAdminDocumentMetricsAction();

    res.status(200).json({
        success: true,
        message: 'Document metrics fetched successfully',
        data: metrics
    });
});
