import { Router } from "express";
import { create, getPaymentById, getPayments } from "../controllers/payment.controller";
import { protect } from "../middleware/auth.middleware";

const router = Router();
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
router.post('/create', create);

/**
 * @route   GET /api/payments
 * @desc    Get Payment by ID
 * @access  Admin and Customer
 */
router.get('/', getPayments)

export default router;