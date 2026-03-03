import { Router } from 'express';
import { validateQuoteRequest } from '../validators/quote.validator';
import { validate } from '../middleware/validate.middleware';
import { rateLimiter } from '../middleware/rateLimiter.middleware';
import {
  submitQuoteRequest,
  trackQuoteRequest,
} from '../controllers/quoteRequest.controller';
import { getAllQuoteRequests, getQuoteRequestById } from '../controllers/quote.controller';
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
 * @route   GET /api/quotes/requests/:id
 * @desc    Get specific quote request details
 * @access  Public
 */
router.get('/requests/:id', getQuoteRequestById);

export default router;