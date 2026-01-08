import { Router } from 'express';
import { protect } from '../middleware/auth.middleware';
import { validateLogin, validateActivateAccount } from '../validators/auth.validator';
import { validate } from '../middleware/validate.middleware';
import { rateLimiter } from '../middleware/rateLimiter.middleware';
import {
  login,
  logout,
  getCurrentUser,
  refreshToken,
  activateAccount,
} from '../controllers/auth.controller';

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
router.post('/activate', validateActivateAccount, validate, activateAccount );

export default router;
