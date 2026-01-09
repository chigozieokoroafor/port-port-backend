import { Request, Response } from 'express';
import QuoteRequest from '../models/QuoteRequest.model';
import { ApiError } from '../utils/ApiError';
import { catchAsync } from '../utils/catchAsync';
import { generateReferenceId } from '../utils/helper';
import { sendQuoteConfirmationEmail } from '../services/email.service';

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
            referenceId,
            customer,
            vehicle,
            route,
            status: 'new',
        });

        // Send confirmation email to customer
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