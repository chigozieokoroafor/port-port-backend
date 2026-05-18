import { Router } from 'express';
import { validateQuoteRequest, validateUpdateStatus } from '../validators/quote.validator';
import { validate } from '../middleware/validate.middleware';
import { rateLimiter } from '../middleware/rateLimiter.middleware';
import { submitQuoteRequest, trackQuoteRequest, getUserQuoteRequests } from '../controllers/quoteRequest.controller';
import { approveQuoteRequest, getAllQuoteRequests, getQuoteById, getQuoteRequestById, rejectQuoteRequest } from '../controllers/quote.controller';
import { protect } from '../middleware/auth.middleware';

const router = Router();
router.use(protect);

/**
 * @route   POST /api/quotes/request
 * @desc    Submit quote request
 * @access  Public
 */
// 5 requests per hour
router.post('/request', rateLimiter({ windowMs: 60 * 60 * 1000, max: 5 }),  validateQuoteRequest, validate, submitQuoteRequest);

/**
 * @route   GET /api/quotes/track/:referenceId
 * @desc    Track quote status by reference ID
 * @access  Public
 */
router.get('/track/:referenceId', trackQuoteRequest);

/**
 * @route   GET /api/quotes/requests
 * @desc    List all quote requests with filters
 * @access  Public
 */
router.get('/requests', getAllQuoteRequests);

/**
 * @route   GET /api/quotes/:id
 * @desc    Get quote details
 */
router.get('/:id', getQuoteById);

/**
 * @route   GET /api/quotes/requests/user/:userId
 * @desc    List all quote requests with filters for current user
 * @access  Public
 */
router.get('/requests/user/:userId', getUserQuoteRequests);


/**
 * @route   GET /api/quotes/requests/:id
 * @desc    Get specific quote request details
 * @access  Public
 */
router.get('/request/:id', getQuoteRequestById);

/**
 * @route   GET /api/quotes/request/:id
 * @desc    Get quote details
 * @access  Admin
 */
router.get('/request/:id', getQuoteRequestById);

/**
 * @route   PATCH /api/quotes/approve/:id
 * @desc    Approve Quote Request
 * @access  Admin
 */
router.patch('/approve/:id', validateUpdateStatus, validate, approveQuoteRequest);

/**
 * @route   PATCH /api/quotes/requests/reject/:id
 * @desc    Reject Quote Request
 * @access  Admin
 */
router.patch('/reject/:id', validateUpdateStatus, validate, rejectQuoteRequest);

export default router;