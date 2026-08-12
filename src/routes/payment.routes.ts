import { Router } from "express";
import { create, getPaymentById, getPayments, getPaymentStatusByReference, paypalReturn } from "../controllers/payment.controller";
import { protect } from "../middleware/auth.middleware";
import { restrictToAdmin } from "../middleware/roleCheck.middleware";
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

/**
 * @route   GET /api/payment/paypal/return
 * @desc    PayPal capture-on-return landing — captures the approved order and redirects
 *          the browser to the frontend success/cancel page (UX only; the webhook fulfills)
 * @access  Public — the buyer arrives via PayPal's redirect, before any auth token exists
 */
router.get('/paypal/return', paypalReturn);

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
 * @route   GET /api/payment
 * @desc    List/search all payments (admin tool — filters by arbitrary customer,
 *          searches Stripe ids). Restricted to Admin/SuperAdmin so a customer can't
 *          enumerate the whole collection. Customers use GET /:id (own, ownership-
 *          checked) and GET /status/:reference (public) instead.
 * @access  Admin
 */
router.get('/', restrictToAdmin, getPayments)

export default router;