import { Request, Response } from 'express';
import QuoteRequest from '../models/QuoteRequest.model';
import Quote from '../models/Quote.model';
import { ApiError } from '../utils/ApiError';
import { catchAsync } from '../utils/catchAsync';
import { generateReferenceId } from '../utils/helper';
import { sendQuoteEmail } from '../services/email/service';
import { UserType } from '../models/enums/UserType.enum';
import { Status } from '../models/enums/Status.enum';

/**
 * @desc    List all quote requests with filters
 * @route   GET /api/admin/quotes/requests
 * @access  Admin
 */
export const getAllQuoteRequests = catchAsync(
    async (req: Request, res: Response) => {
        const {
            status,
            search,
            startDate,
            endDate,
            page = 1,
            limit = 10,
            isCustomer
        } = req.query;

        if(!isCustomer && req.user?.role === UserType.Customer){
            throw new ApiError(400, 'Cannot view Quote requests. Invalid user role');
        }
        // Build filter
        const filter: any = {};
         
        if (status) {
            filter.status = status;
        }

        if (search) {
            filter.$or = [
                { referenceId: { $regex: search, $options: 'i' } },
                { 'customer.fullName': { $regex: search, $options: 'i' } },
                { 'customer.email': { $regex: search, $options: 'i' } },
                { 'vehicle.vin': { $regex: search, $options: 'i' } },
            ];
        }

        if (startDate || endDate) {
            filter.createdAt = {};
            if (startDate) filter.createdAt.$gte = new Date(startDate as string);
            if (endDate) filter.createdAt.$lte = new Date(endDate as string);
        }
       
        if(isCustomer){
            filter.user = req.user?._id
        }

        // Pagination
        const pageNum = Number.parseInt(page as string, 10);
        const limitNum = Number.parseInt(limit as string, 10);
        const skip = (pageNum - 1) * limitNum;

        // Get total count
        const total = await QuoteRequest.countDocuments(filter);

        // Get requests
        const requests = await QuoteRequest.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum);

        res.status(200).json({
            success: true,
            data: {
                requests,
                pagination: {
                    page: pageNum,
                    limit: limitNum,
                    total,
                    pages: Math.ceil(total / limitNum),
                },
            },
        });
    }
);

/**
 * @desc    Get specific quote request details
 * @route   GET /api/admin/quotes/requests/:id
 * @access  Admin
 */
export const getQuoteRequestById = catchAsync(
    async (req: Request, res: Response) => {
        const { id } = req.params;

        const request = await QuoteRequest.findById(id);

        if (!request) {
            throw new ApiError(404, 'Quote request not found');
        }

        // Get associated quote if exists
        const quote = await Quote.findOne({ quoteRequestId: id }).populate(
            'generatedBy',
            'firstName lastName email'
        );

        res.status(200).json({
            success: true,
            data: {
                request,
                quote,
            },
        });
    }
);

/**
 * @desc    Update quote request status
 * @route   PUT /api/admin/quotes/requests/:id/status
 * @access  Admin
 */
export const updateQuoteRequestStatus = catchAsync(
    async (req: Request, res: Response) => {
        const { id } = req.params;
        const { status, notes } = req.body;

        const request = await QuoteRequest.findById(id);

        if (!request) {
            throw new ApiError(404, 'Quote request not found');
        }

        request.status = status;
        if (notes !== undefined) {
            request.notes = notes;
        }

        await request.save();

        res.status(200).json({
            success: true,
            message: 'Quote request status updated successfully',
            data: { request },
        });
    }
);

/**
 * @desc    Approve quote request 
 * @route   PATCH /api/admin/quotes/requests/approve/:id
 * @access  Admin
 */
export const approveQuoteRequest = catchAsync(
    async (req: Request, res: Response) => {
        const { id } = req.params;

        if(!req.user){
            throw new ApiError(400, 'User not authenticated');
        }

        const request = await QuoteRequest.findById(id);

        if (!request) {
            throw new ApiError(404, 'Quote request not found');
        }

        if(request.status != Status.Pending){
            throw new ApiError(400, `Quote request has been ${request.status}`)
        }
       
        request.status = Status.Approved;
        request.reviewedByUserId = req.user._id;
        request.reviewedBy = req.user.getFullName();
        request.reviewedDate = new Date();

        await request.save();

        res.status(200).json({
            success: true,
            message: 'Quote request approved successfully',
            data: { request },
        });
    }
);

/**
 * @desc    Reject quote request
 * @route   PATCH /api/admin/quotes/requests/reject/:id
 * @access  Admin
 */
export const rejectQuoteRequest = catchAsync(
    async (req: Request, res: Response) => {
        const { id } = req.params;

        if(!req.user){
            throw new ApiError(400, 'User not authenticated');
        }

        const request = await QuoteRequest.findById(id);

        if (!request) {
            throw new ApiError(404, 'Quote request not found');
        }

        if(request.status != Status.Pending){
            throw new ApiError(400, `Quote request has been ${request.status}`)
        }

        request.status = Status.Rejected;
        request.reviewedByUserId = req.user._id;
        request.reviewedBy = req.user.getFullName();
        request.reviewedDate = new Date();
        if (req.body?.notes !== undefined) {
            request.notes = req.body.notes;
        }

        await request.save();

        res.status(200).json({
            success: true,
            message: 'Quote request rejected successfully',
            data: { request },
        });
    }
);

/**
 * @desc    Delete quote request
 * @route   DELETE /api/admin/quotes/requests/:id
 * @access  Admin
 */
export const deleteQuoteRequest = catchAsync(
    async (req: Request, res: Response) => {
        const { id } = req.params;

        const request = await QuoteRequest.findById(id);

        if (!request) {
            throw new ApiError(404, 'Quote request not found');
        }

        // Check if quote has been generated
        const quote = await Quote.findOne({ quoteRequestId: id });
        if (quote) {
            throw new ApiError(
                400,
                'Cannot delete quote request with associated quote. Delete the quote first.'
            );
        }

        await QuoteRequest.findByIdAndDelete(id);

        res.status(200).json({
            success: true,
            message: 'Quote request deleted successfully',
        });
    }
);

/**
 * @desc    Generate pricing quote
 * @route   POST /api/admin/quotes/:requestId/generate
 * @access  Admin
 */
export const generateQuote = catchAsync(
    async (req: Request, res: Response) => {
        const { requestId } = req.params;
        const { pricing, terms } = req.body;

        if (!req.user) {
            throw new ApiError(401, 'Not authenticated');
        }

        // Check if request exists
        const request = await QuoteRequest.findById(requestId);
        if (!request) {
            throw new ApiError(404, 'Quote request not found');
        }

        // Check if quote already exists
        const existingQuote = await Quote.findOne({ quoteRequestId: requestId });
        if (existingQuote) {
            throw new ApiError(400, 'Quote already exists for this request');
        }

        // Generate quote number
        const quoteNumber = generateReferenceId('QT');

        // Create quote
        const quote = await Quote.create({
            quoteNumber,
            quoteRequestId: requestId,
            pricing,
            terms,
            status: 'draft',
            generatedBy: req.user._id,
        });

        // Update request status
       // request.status = 'quoted';
        await request.save();

        res.status(201).json({
            success: true,
            message: 'Quote generated successfully',
            data: { quote },
        });
    }
);

/**
 * @desc    Update quote details
 * @route   PUT /api/admin/quotes/:id
 * @access  Admin
 */
export const updateQuote = catchAsync(
    async (req: Request, res: Response) => {
        const { id } = req.params;
        const { pricing, terms } = req.body;

        const quote = await Quote.findById(id);

        if (!quote) {
            throw new ApiError(404, 'Quote not found');
        }

        // Only allow updates for draft or sent quotes
        if (!['draft', 'sent'].includes(quote.status)) {
            throw new ApiError(
                400,
                `Cannot update quote with status: ${quote.status}`
            );
        }

        if (pricing) {
            quote.pricing = { ...quote.pricing, ...pricing };
        }

        if (terms) {
            quote.terms = { ...quote.terms, ...terms };
        }

        await quote.save();

        res.status(200).json({
            success: true,
            message: 'Quote updated successfully',
            data: { quote },
        });
    }
);

/**
 * @desc    Get quote details
 * @route   GET /api/admin/quotes/:id
 * @access  Admin
 */
export const getQuoteById = catchAsync(
    async (req: Request, res: Response) => {
        const { id } = req.params;

        const quote = await Quote.findById(id)
        .populate('quoteRequestId')
        .populate('generatedBy', 'firstName lastName email');

        if (!quote) {
            throw new ApiError(404, 'Quote not found');
        }

        res.status(200).json({
            success: true,
            data: { quote },
        });
    }
);

/**
 * @desc    Send quote email to customer
 * @route   POST /api/admin/quotes/:id/send
 * @access  Admin
 */
export const sendQuote = catchAsync(
    async (req: Request, res: Response) => {
        const { id } = req.params;

        const quote = await Quote.findById(id).populate('quoteRequestId');

        if (!quote) {
            throw new ApiError(404, 'Quote not found');
        }

        const request = quote.quoteRequestId as any;

        if (!request) {
            throw new ApiError(404, 'Associated quote request not found');
        }

        // Send quote email
        await sendQuoteEmail({
            to: request.customer.email,
            customerName: request.customer.fullName,
            quoteNumber: quote.quoteNumber,
            referenceId: request.referenceId,
            pricing: quote.pricing,
            terms: quote.terms,
            vehicle: request.vehicle,
            route: request.route,
        });

        // Update quote status
        quote.status = 'sent';
        quote.sentAt = new Date();
        await quote.save();

        res.status(200).json({
            success: true,
            message: 'Quote sent successfully',
            data: { quote },
        });
    }
);

/**
 * @desc    List all quotes
 * @route   GET /api/admin/quotes
 * @access  Admin
 */
export const getAllQuotes = catchAsync(
    async (req: Request, res: Response) => {
        const { status, page = 1, limit = 10 } = req.query;

        // Build filter
        const filter: any = {};
        if (status) {
            filter.status = status;
        }

        // Pagination
        const pageNum = Number.parseInt(page as string, 10);
        const limitNum = Number.parseInt(limit as string, 10);
        const skip = (pageNum - 1) * limitNum;

        // Get total count
        const total = await Quote.countDocuments(filter);

        // Get quotes
        const quotes = await Quote.find(filter)
        .populate('quoteRequestId', 'referenceId customer vehicle')
        .populate('generatedBy', 'firstName lastName')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum);

        res.status(200).json({
            success: true,
            data: {
                quotes,
                pagination: {
                page: pageNum,
                limit: limitNum,
                total,
                pages: Math.ceil(total / limitNum),
                },
            },
        });
    }
);