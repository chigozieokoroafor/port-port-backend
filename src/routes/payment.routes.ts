import { Router } from "express";
// import { create, getPaymentById, getPayments, getPaymentStatusByReference, paypalReturn } from "../controllers/payment.controller";
import { protect } from "../middleware/auth.middleware";
import { restrictToAdmin } from "../middleware/roleCheck.middleware";
import { rateLimiter } from "../middleware/rateLimiter.middleware";
import { validate } from "../middleware/validate.middleware";
import { validateCreatePayment } from "../validators/payment.validator";
import { getPaymentStatusByReference } from "../controllers/payment/get-payment-by-reference";
import { paypalReturn } from "../controllers/payment/webhook/paypal";
import { getPaymentById } from "../controllers/payment/get-payment-by-id";
import { getPayments } from "../controllers/payment/list-payments";
import { createPaymentV2Controller } from "../controllers/payment/create-payment-v2";
import { listUserPaymentsController } from "../controllers/payment/list-user-payments";

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
 * @route   POST /api/payment/v2/create
 * @desc   Create Payment Link (V2 Prisma)
 * @access   Customer
 */
router.post('/v2/create', createPaymentV2Controller);

/**
 * @route   GET /api/payment/history/user/:userId
 * @desc    List payment history for a user
 * @access  Customer
 */
router.get('/history/user/:userId', listUserPaymentsController);

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