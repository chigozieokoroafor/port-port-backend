import { Router } from 'express';
import { protect } from '../middleware/auth.middleware';
import { restrictToSuperAdmin } from '../middleware/roleCheck.middleware';
import { validateInviteAdmin, validateUpdateAdmin } from '../validators/admin.validator';
import { validate } from '../middleware/validate.middleware';
import {
  inviteAdmin,
  getAllAdmins,
  getAdminById,
  updateAdmin,
  deleteAdmin,
  resendInvite,
} from '../controllers/admin.controller';

const router = Router();

// All routes require authentication and SuperAdmin role
router.use(protect);
router.use(restrictToSuperAdmin);

/**
 * @route   POST /api/admin/invite
 * @desc    Invite new admin user
 * @access  SuperAdmin only
 */
router.post('/invite', validateInviteAdmin, validate, inviteAdmin);

/**
 * @route   GET /api/admin/users
 * @desc    Get all admin users with pagination and filters
 * @access  SuperAdmin only
 */
router.get('/users', getAllAdmins);

/**
 * @route   GET /api/admin/users/:id
 * @desc    Get single admin user details
 * @access  SuperAdmin only
 */
router.get('/users/:id', getAdminById);

/**
 * @route   PUT /api/admin/users/:id
 * @desc    Update admin user
 * @access  SuperAdmin only
 */
router.put('/users/:id', validateUpdateAdmin, validate, updateAdmin);

/**
 * @route   DELETE /api/admin/users/:id
 * @desc    Delete admin user
 * @access  SuperAdmin only
 */
router.delete('/users/:id', deleteAdmin);

/**
 * @route   POST /api/admin/users/:id/resend-invite
 * @desc    Resend invite to pending admin
 * @access  SuperAdmin only
 */
router.post('/users/:id/resend-invite', resendInvite);

export default router;