import { Request, Response } from 'express';
import { catchAsync } from "../../../../utils/catchAsync";
import { listCustomersAction } from "./util";

export const listCustomersController = catchAsync(async (req: Request, res: Response) => {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const search = req.query.search as string;
    const status = req.query.status as string;

    const result = await listCustomersAction({ page, limit, search, status });

    res.status(200).json({
        success: true,
        message: 'Customers retrieved successfully',
        data: result
    });
});
