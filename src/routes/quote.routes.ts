import { Router } from 'express';
import { protect } from '../middleware/auth.middleware';
import { restrictToAdmin } from '../middleware/roleCheck.middleware';
import { validate } from '../middleware/validate.middleware';
import {
  deleteQuoteRequest,
  generateQuote,
  updateQuote,
  sendQuote,
  getAllQuotes
} from '../controllers/quote.controller';
import {
  validateGenerateQuote,
  validateUpdateQuote
} from '../validators/quote.validator';
import { getQuotesController } from '../controllers/admin/quotes/get-quotes';
import { approveQuoteController } from '../controllers/admin/quotes/approve-quote';

const router = Router();

router.use(protect);
router.use(restrictToAdmin);


/**
 * @route   DELETE /api/admin/quotes/requests/:id
 * @desc    Delete quote request
 * @access  Admin
 */
router.delete('/requests/:id', deleteQuoteRequest);

/**
 * @route   POST /api/admin/quotes/:requestId/generate
 * @desc    Generate pricing quote (Approve Quote Request)
 * @access  Admin
 */
router.post('/:requestId/generate', approveQuoteController);

/**
 * @route   GET /api/admin/quotes
 * @desc    List all quotes
 * @access  Admin
 */
router.get('/', getAllQuotes);


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

router.get("/list", getQuotesController)

export default router;