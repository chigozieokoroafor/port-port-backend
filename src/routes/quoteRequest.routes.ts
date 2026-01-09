import { Router } from 'express';
import { validateQuoteRequest } from '../validators/quote.validator';
import { validate } from '../middleware/validate.middleware';
import { rateLimiter } from '../middleware/rateLimiter.middleware';
import {
  submitQuoteRequest,
  trackQuoteRequest,
} from '../controllers/quoteRequest.controller';

const router = Router();

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

export default router;