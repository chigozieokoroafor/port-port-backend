import { Router } from 'express';
import { protect } from '../middleware/auth.middleware';
import { restrictToAdmin } from '../middleware/roleCheck.middleware';
import { getAdminDashboardMetricsController } from '../controllers/admin/dashboard/get-metrics';
import { getAdminActionsRequiredController } from '../controllers/admin/dashboard/get-actions-required';
import { getAdminRecentActivityController } from '../controllers/admin/dashboard/get-recent-activity';

const router = Router();

router.use(protect);
router.use(restrictToAdmin);

/**
 * @route   GET /api/dashboard/admin/metrics
 * @desc    Get admin dashboard top-level summary metrics
 * @access  Admin / SuperAdmin
 */
router.get('/admin/metrics', getAdminDashboardMetricsController);

/**
 * @route   GET /api/dashboard/admin/actions-required
 * @desc    Get pending/unresolved items requiring admin action
 * @access  Admin / SuperAdmin
 */
router.get('/admin/actions-required', getAdminActionsRequiredController);

/**
 * @route   GET /api/dashboard/admin/recent-activity
 * @desc    Get paginated chronological activity feed for admin dashboard
 * @access  Admin / SuperAdmin
 */
router.get('/admin/recent-activity', getAdminRecentActivityController);

export default router;
