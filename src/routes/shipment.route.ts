import { Router } from "express";
import { protect } from "../middleware/auth.middleware";
// import { createShipmentController } from "../controllers/shipment/create-shipment";

import { listUserShipmentsController } from "../controllers/user-shipment/list-shipments";
import { restrictToAdmin } from "../middleware/roleCheck.middleware";
import { listAdminShipmentsController } from "../controllers/admin/shipments/list-shipments";
import { createShipmentController } from "../controllers/admin/shipments/create-shipment";
import { getShipmentMetricsController } from "../controllers/admin/shipments/get-metrics";

const router = Router();
router.use(protect);

router.post('/create', createShipmentController);

/**
 * @route   GET /api/shipments/admin/metrics
 * @desc    Get shipment metrics for admin
 * @access  Admin
 */
router.get('/admin/metrics', restrictToAdmin, getShipmentMetricsController);

/**
 * @route   GET /api/shipments/user/:userId
 * @desc    List shipments for a user
 * @access  Customer
 */
router.get('/user/:userId', listUserShipmentsController);

/**
 * @route   GET /api/shipments/admin
 * @desc    List shipments for admin
 * @access  Admin
 */
router.get('/admin', restrictToAdmin, listAdminShipmentsController);

export default router;