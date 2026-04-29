import { Request, Response } from 'express';
import QuoteRequest from '../models/QuoteRequest.model';
import { ApiError } from '../utils/ApiError';
import { catchAsync } from '../utils/catchAsync';
import { generateReferenceId } from '../utils/helper';
import { sendQuoteConfirmationEmail } from '../services/email/service'

/**
 * @desc    Submit quote request
 * @route   POST /api/quotes/request
 * @access  Public
 */
export const submitQuoteRequest = catchAsync(
    async (req: Request, res: Response) => {
        const { customer, vehicle, route } = req.body;

        // Generate unique reference ID
        const referenceId = generateReferenceId('QR');

        // Create quote request
        const quoteRequest = await QuoteRequest.create({
            user: req.user?._id,
            referenceId,
            customer,
            vehicle,
            route
        });

       //Send confirmation email to customer
        try {
            await sendQuoteConfirmationEmail(
                customer.email,
                referenceId,
                customer.fullName
            );
        } catch (emailError) {
            // Log error but don't fail the request
            console.error('Failed to send confirmation email:', emailError);
        }
        // Send email to the admin
        try {
            await sendQuoteConfirmationEmail(
                "[EMAIL_ADDRESS]",
                referenceId,
                "Admin"
            );
        } catch (emailError) {
            // Log error but don't fail the request
            console.error('Failed to send confirmation email:', emailError);
        }

        res.status(201).json({
            success: true,
            message: 'Quote request submitted successfully',
            data: {
                referenceId: quoteRequest.referenceId,
                status: quoteRequest.status,
                createdAt: quoteRequest.createdAt,
            },
        });
    }
);


/**
 * @desc    Track quote status by reference ID
 * @route   GET /api/quotes/track/:referenceId
 * @access  Public
 */
export const trackQuoteRequest = catchAsync(
    async (req: Request, res: Response) => {
        const { referenceId } = req.params;

        const quoteRequest = await QuoteRequest.findOne({ referenceId });

        if (!quoteRequest) {
            throw new ApiError(404, 'Quote request not found');
        }

        res.status(200).json({
            success: true,
            data: {
                referenceId: quoteRequest.referenceId,
                status: quoteRequest.status,
                customer: {
                    fullName: quoteRequest.customer.fullName,
                    email: quoteRequest.customer.email,
                },
                vehicle: {
                    type: quoteRequest.vehicle.type,
                    make: quoteRequest.vehicle.make,
                    model: quoteRequest.vehicle.model,
                    year: quoteRequest.vehicle.year,
                },
                route: {
                    originCountry: quoteRequest.route.originCountry,
                    originPort: quoteRequest.route.originPort,
                    destinationCountry: quoteRequest.route.destinationCountry,
                    destinationPort: quoteRequest.route.destinationPort,
                },
                createdAt: quoteRequest.createdAt,
                updatedAt: quoteRequest.updatedAt,
            },
        });
    }
);

/**
 * @desc    Get Quote request by ID 
 * @route   GET /api/quotes/requests/:id
 * @access  User 
 */
export const getQuoteRequestById = catchAsync(
    async (req: Request, res: Response) => {

        const quoteRequest = await QuoteRequest.findById(req.params.id);

        if (!quoteRequest) {
            throw new ApiError(404, 'Quote request not found');
        }

        res.status(200).json({
            success: true,
            data: {
                quoteRequest,
            },
        });
    }
)

/**
 * @desc    Get Quote requests by User ID 
 * @route   GET /api/quotes/requests/user/:userId
 * @access  User 
 */
export const getUserQuoteRequests = catchAsync(
    async (req: Request, res: Response) => {
        const { userId: requestedUserId } = req.params;
        const userId = req.user?._id;

        if (userId?.toString() !== requestedUserId) {
            throw new ApiError(400, 'You cannot view other users quote requests');
        }

        const quoteRequests = await QuoteRequest.find({ user: userId }).sort({ createdAt: -1 });

        res.status(200).json({
            success: true,
            data: {
                quoteRequests,
            },
        });
    }
)


/**
 * @desc    Update Quote request 
 * @route   PUT /api/quotes/requests/:id
 * @access  User 
 */
export const updateQuoteRequest = catchAsync(
    async (req: Request, res: Response) => {
        const { id } = req.params;
        const { customer, vehicle, route } = req.body;

        const quoteRequest = await QuoteRequest.findByIdAndUpdate(id, {
            customer,
            vehicle,
            route,
        }, { new: true });

        if (!quoteRequest) {
            throw new ApiError(404, 'Quote request not found');
        }

        res.status(200).json({
            success: true,
            message: 'Quote request updated successfully',
            data: {
                quoteRequest,
            },
        });
    }
)

/**
 * @desc    Delete Quote request 
 * @route   DELETE /api/quotes/requests/:id
 * @access  User 
 */
export const deleteQuoteRequest = catchAsync(
    async (req: Request, res: Response) => {
        const { id } = req.params;

        const quoteRequest = await QuoteRequest.findByIdAndDelete(id);

        if (!quoteRequest) {
            throw new ApiError(404, 'Quote request not found');
        }

        res.status(200).json({
            success: true,
            message: 'Quote request deleted successfully',
        });
    }
)