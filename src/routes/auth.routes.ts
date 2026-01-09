import { Router } from 'express';
import { protect } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate.middleware';
import { rateLimiter } from '../middleware/rateLimiter.middleware';
import {
  login,
  logout,
  getCurrentUser,
  refreshToken,
  activateAccount,
  changePassword,
  forgotPassword,
  resetPassword,
} from '../controllers/auth.controller';
import { 
  validateLogin, 
  validateActivateAccount,
  validateChangePassword,
  validateForgotPassword,
  validateResetPassword,
} from '../validators/auth.validator';

const router = Router();

/**
 * @route   GET /api/auth
 * @desc    Get current logged-in user profile
 * @access  Private
 */
router.get('/', protect, getCurrentUser);

/**
 * @route   POST /api/auth/login
 * @desc    Admin/SuperAdmin login
 * @access  Public
 */
// 5 requests per 15 minutes
router.post( '/login', rateLimiter({ windowMs: 15 * 60 * 1000, max: 5 }), validateLogin, validate, login);

/**
 * @route   POST /api/auth/logout
 * @desc    Logout user (invalidate token on client side)
 * @access  Private
 */
router.post('/logout', protect, logout);

/**
 * @route   POST /api/auth/refresh
 * @desc    Refresh access token
 * @access  Private
 */
router.post('/refresh', protect, refreshToken);

/**
 * @route   POST /api/auth/activate
 * @desc    Activate invited admin account
 * @access  Public
 */
router.post('/activate', validateActivateAccount, validate, activateAccount);

/**
 * @route   PUT /api/auth/change-password
 * @desc    Change password (logged in user)
 * @access  Private
 */
router.put('/change-password', protect, validateChangePassword, validate, changePassword);

/**
 * @route   POST /api/auth/forgot-password
 * @desc    Request password reset email
 * @access  Public
 */
// 3 requests per 15 minutes
router.post( '/forgot-password', rateLimiter({ windowMs: 15 * 60 * 1000, max: 3 }), validateForgotPassword, validate, forgotPassword);

/**
 * @route   POST /api/auth/reset-password
 * @desc    Reset password with token
 * @access  Public
 */
// 5 requests per 15 minutes
router.post('/reset-password', rateLimiter({ windowMs: 15 * 60 * 1000, max: 5 }),  validateResetPassword, validate, resetPassword);

export default router;
