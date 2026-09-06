import { Router } from "express";
import { protect } from "../middleware/auth.middleware";
import { restrictToAdmin } from "../middleware/roleCheck.middleware";
import { listCustomersController } from "../controllers/admin/customers/list-customers";
import { getCustomerMetricsController } from "../controllers/admin/customers/get-metrics";
import { getCustomerProfileController } from "../controllers/admin/customers/get-customer";

const router = Router();

router.use(protect);
router.use(restrictToAdmin);

/**
 * @route   GET /api/customers/metrics
 * @desc    Get metrics for customers (admin only)
 * @access  Admin/SuperAdmin
 */
router.get('/metrics', getCustomerMetricsController);

/**
 * @route   GET /api/customers
 * @desc    List all customers with pagination, search, and status filter
 * @access  Admin/SuperAdmin
 */
router.get('/', listCustomersController);

/**
 * @route   GET /api/customers/:id
 * @desc    Get individual customer profile details
 * @access  Admin/SuperAdmin
 */
router.get('/:id', getCustomerProfileController);

export default router;
