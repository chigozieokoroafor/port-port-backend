import { Router } from "express";
import { create, getPaymentById, getPayments, getPaymentStatusByReference } from "../controllers/payment.controller";
import { protect } from "../middleware/auth.middleware";
import { rateLimiter } from "../middleware/rateLimiter.middleware";
import { validate } from "../middleware/validate.middleware";
import { validateCreatePayment } from "../validators/payment.validator";

const router = Router();

/**
 * @route   GET /api/payment/status/:reference
 * @desc    Public payment-status lookup by quote reference (item 12)
 * @access  Public — registered before `protect`, rate-limited since it's unauthenticated
 */
router.get('/status/:reference', rateLimiter({ windowMs: 15 * 60 * 1000, max: 20 }), getPaymentStatusByReference);

router.use(protect);


/**
 * @route   GET /api/payment/:id
 * @desc    Get Payment by ID
 * @access  Admin and Customer
 */
router.get('/:id', getPaymentById);

/**
 * @route   POST /api/payment/create
 * @desc   Create Payment Link
 * @access   Customer
 */
router.post('/create', validateCreatePayment, validate, create);

/**
 * @route   GET /api/payments
 * @desc    Get Payment by ID
 * @access  Admin and Customer
 */
router.get('/', getPayments)

export default router;