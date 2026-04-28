import { Router } from 'express';
import { protect } from '../middleware/auth.middleware';
import { restrictToAdmin } from '../middleware/roleCheck.middleware';
import { validate } from '../middleware/validate.middleware';
import {
  deleteQuoteRequest,
  generateQuote,
  updateQuote,
  getQuoteById,
  sendQuote,
  getAllQuotes,
  approveQuoteRequest,
  rejectQuoteRequest,
  getQuoteRequestById
} from '../controllers/quote.controller';
import {
  validateGenerateQuote,
  validateUpdateQuote,
  validateUpdateStatus,
} from '../validators/quote.validator';

const router = Router();

router.use(protect);
router.use(restrictToAdmin);


/**
 * @route   PATCH /api/admin/quotes/requests/approve/:id
 * @desc    Approve Quote Request
 * @access  Admin
 */
router.patch('/requests/approve/:id', validateUpdateStatus, validate, approveQuoteRequest);

/**
 * @route   PATCH /api/admin/quotes/requests/reject/:id
 * @desc    Reject Quote Request
 * @access  Admin
 */
router.patch('/requests/reject/:id', validateUpdateStatus, validate, rejectQuoteRequest);


/**
 * @route   DELETE /api/admin/quotes/requests/:id
 * @desc    Delete quote request
 * @access  Admin
 */
router.delete('/requests/:id', deleteQuoteRequest);

/**
 * @route   POST /api/admin/quotes/:requestId/generate
 * @desc    Generate pricing quote
 * @access  Admin
 */
router.post('/:requestId/generate', validateGenerateQuote, validate, generateQuote);

/**
 * @route   GET /api/admin/quotes
 * @desc    List all quotes
 * @access  Admin
 */
router.get('/', getAllQuotes);

/**
 * @route   GET /api/admin/quotes/:id
 * @desc    Get quote details
 * @access  Admin
 */
router.get('/:id', getQuoteById);

/**
 * @route   GET /api/admin/quotes/request/:id
 * @desc    Get quote details
 * @access  Admin
 */
router.get('/request/:id', getQuoteRequestById);

/**
 * @route   PUT /api/admin/quotes/:id
 * @desc    Update quote details
 * @access  Admin
 */
router.put('/:id', validateUpdateQuote, validate, updateQuote);

/**
 * @route   POST /api/admin/quotes/:id/send
 * @desc    Send quote email to customer
 * @access  Admin
 */
router.post('/:id/send', sendQuote);

export default router;