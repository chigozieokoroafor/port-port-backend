import { Request, Response } from 'express';
import QuoteRequest, { IQuoteRequest } from '../models/QuoteRequest.model';
import Quote, { IQuote } from '../models/Quote.model';
import { ApiError } from '../utils/ApiError';
import { catchAsync } from '../utils/catchAsync';
import { generateReferenceId } from '../utils/helper';
import { sendQuoteEmail, sendQuoteEmailToCustomer } from '../services/email/service';
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

        if (!isCustomer && req.user?.role === UserType.Customer) {
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

        if (isCustomer) {
            filter.user = req.user?._id
        }

        // Pagination
        const pageNum: number = Number.parseInt(page as string, 10);
        const limitNum: number = Number.parseInt(limit as string, 10);
        const skip: number = (pageNum - 1) * limitNum;

        // Get total count
        const total = await QuoteRequest.countDocuments(filter);

        // Get requests
        const requests: IQuoteRequest[] | null = await QuoteRequest.find(filter)
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
        const request = await QuoteRequest.findOne({ _id: id });
        if (!request) {
            throw new ApiError(404, 'Quote not found');
        }

        // Get associated quote if exists
        const quote: IQuote | null = await Quote.findOne({ quoteRequestId: id }).populate(
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

        const request: IQuoteRequest | null = await QuoteRequest.findById(id);

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
 * @route   PATCH /api/quotes/approve/:id
 * @access  Admin
 */
export const approveQuoteRequest = catchAsync(
    async (req: Request, res: Response) => {
        const { id } = req.params;

        if (!req.user) {
            throw new ApiError(400, 'User not authenticated');
        }

    
        const quote: IQuote | null = await Quote.findById(id);
        if (!quote) {
            throw new ApiError(404, 'Quote not found');
        }


        if (quote.status == Status.Approved) {
            throw new ApiError(400, `Quote has been ${quote.status}`)
        }

        quote.status = Status.Approved;

        await quote.save();

        res.status(200).json({
            success: true,
            message: 'Quote approved successfully',
            data: { 
                quote
             },
        });
    }
);

/**
 * @desc    Reject quote request
 * @route   PATCH /api/quotes/reject/:id
 * @access  Admin
 */
export const rejectQuoteRequest = catchAsync(
    async (req: Request, res: Response) => {
        const { id } = req.params;

        if (!req.user) {
            throw new ApiError(400, 'User not authenticated');
        }

        const quote: IQuote | null = await Quote.findById(id);

        if (!quote) {
            throw new ApiError(404, 'Quote not found');
        }

        if (quote.status == Status.Approved) {
            throw new ApiError(400, `Quote request has been ${quote.status}`)
        }

        quote.status = Status.Rejected;
        quote.updatedBy = req.user._id;

        await quote.save();

        res.status(200).json({
            success: true,
            message: 'Quote rejected successfully'
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

        const request: IQuoteRequest | null = await QuoteRequest.findById(id);

        if (!request) {
            throw new ApiError(404, 'Quote request not found');
        }

        // Check if quote has been generated
        const quote: IQuote | null = await Quote.findOne({ quoteRequestId: id });
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
        const { pricing, terms, notes } = req.body;

        if (!req.user) {
            throw new ApiError(401, 'Not authenticated');
        }

        // Check if request exists
        const request: IQuoteRequest | null = await QuoteRequest.findById(requestId);

        if (!request) {
            throw new ApiError(404, 'Quote request not found');
        }
        request.status = Status.Approved;
        request.save();
        // Check if quote already exists
        let quote: IQuote | null = await Quote.findOne({ quoteRequestId: requestId });
        
         if (quote) {
            quote.pricing = pricing ?? quote.pricing;
            quote.terms = terms ?? quote.terms;
            quote.notes = notes ?? quote.notes;
            quote.status = Status.Pending;
            quote.generatedBy = req.user._id;
            
            await quote.save();
        } else {
            const quoteNumber = generateReferenceId('QT');
            
            quote = await Quote.create({
                quoteNumber,
                quoteRequestId: requestId,
                pricing,
                terms,
                notes,
                status: Status.Pending,
                generatedBy: req.user._id,
            });
        }

        //send quote mail;
        await sendQuoteEmailToCustomer(request.customer.email, quote._id.toString(), quote.quoteNumber,request._id.toString(), request.customer.fullName);

        res.status(200).json({
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

        const quote: IQuote | null = await Quote.findById(id);

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
       
        const quote: IQuote | null = await Quote.findById(id)
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
 * @desc    Get quote details by Quote Request
 * @route   GET /api/admin/quotes/:requestid
 * @access  Admin
 */
export const getQuoteByRequestId = catchAsync(
    async (req: Request, res: Response) => {
        const { requestId } = req.params;

        const quote: IQuote | null = await Quote.findOne({quoteRequestId: requestId})
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

        const quote: IQuote | null = await Quote.findById(id).populate('quoteRequestId');

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
       // quote.status = 'sent';
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
        const pageNum: number = Number.parseInt(page as string, 10);
        const limitNum: number = Number.parseInt(limit as string, 10);
        const skip: number = (pageNum - 1) * limitNum;

        // Get total count
        const total = await Quote.countDocuments(filter);

        // Get quotes
        const quotes: IQuote[] | [] = await Quote.find(filter)
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