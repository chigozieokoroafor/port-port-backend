import { Request, Response } from 'express';
import { catchAsync } from "../../../../utils/catchAsync";
import { ApiError } from "../../../../utils/ApiError";
import { CreateShipmentDTO, createShipmentAction, validateDTO } from "./util";
// import { AuthRequest } from "../../../../middleware/auth.middleware"; 

export const createShipmentController = catchAsync(async (req: Request, res: Response) => {
    let validatedBody;
    try {
        validatedBody = await validateDTO(req.body, CreateShipmentDTO);
    } catch (error: any) {
        throw new ApiError(400, error.errors?.[0] || 'Invalid request body');
    }

    const adminId = (req as any).user._id || (req as any).user.id; // Assumes auth middleware sets req.user
    if (!adminId) {
        throw new ApiError(401, 'Unauthorized');
    }

    const shipment = await createShipmentAction(validatedBody, adminId);

    res.status(201).json({
        success: true,
        message: 'Shipment created successfully',
        data: shipment
    });
});
