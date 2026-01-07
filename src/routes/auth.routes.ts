import { Router } from 'express';
import {
  login,
  logout,
  getCurrentUser,
  refreshToken,
  activateAccount,
} from '../controllers/auth.controller';
import { protect } from '../middleware/auth.middleware';
import { validateLogin, validateActivateAccount } from '../validators/auth.validator';
import { validate } from '../middleware/validate.middleware';
import { rateLimiter } from '../middleware/rateLimiter.middleware';

const router = Router();

/**
 * @route   POST /api/auth/login
 * @desc    Admin/SuperAdmin login
 * @access  Public
 */
router.post(
  '/login',
  rateLimiter({ windowMs: 15 * 60 * 1000, max: 5 }), // 5 requests per 15 minutes
  validateLogin,
  validate,
  login
);

/**
 * @route   POST /api/auth/logout
 * @desc    Logout user (invalidate token on client side)
 * @access  Private
 */
router.post('/logout', protect, logout);

/**
 * @route   GET /api/auth/me
 * @desc    Get current logged-in user profile
 * @access  Private
 */
router.get('/me', protect, getCurrentUser);

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
router.post(
  '/activate',
  validateActivateAccount,
  validate,
  activateAccount
);

export default router;
