import { Router } from "express";
import { getPaymentById, getPayments } from "../controllers/payment.controller";

const router = Router();


/**
 * @route   GET /api/payment/:id
 * @desc    Get Payment by ID
 * @access  Admin and Customer
 */
router.get('/:id', getPaymentById);

/**
 * @route   GET /api/payments
 * @desc    Get Payment by ID
 * @access  Admin and Customer
 */
router.get('/', getPayments)

export default router;