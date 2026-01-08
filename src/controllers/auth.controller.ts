import { Request, Response } from 'express';
import jwt, { SignOptions } from 'jsonwebtoken';
import AdminUser from '../models/AdminUser.model';
import TokenBlacklist from '../models/TokenBlacklist.model';
import { ApiError } from '../utils/ApiError';
import { catchAsync } from '../utils/catchAsync';

/**
 * Generate JWT token
 */
const generateToken = (id: string, email: string, role: string): string => {
  const options: SignOptions = {
    expiresIn: '7d',
    // expiresIn: process.env.JWT_EXPIRE || '7d',
  };

  return jwt.sign(
    { id, email, role },
    process.env.JWT_SECRET as string,
    options
  );
};

/**
 * @desc    Login admin/superadmin
 * @route   POST /api/auth/login
 * @access  Public
 */
export const login = catchAsync(async (req: Request, res: Response) => {
  const { email, password } = req.body;

  // Check if user exists (with password field)
  const user = await AdminUser.findOne({ email }).select('+password');

  if (!user) {
    throw new ApiError(401, 'Invalid credentials');
  }

  // Check if account is active
  if (user.status === 'suspended') {
    throw new ApiError(403, 'Your account has been suspended');
  }

  if (user.status === 'pending') {
    throw new ApiError(403, 'Please activate your account first');
  }

  // Check password
  const isPasswordCorrect = await user.comparePassword(password);

  if (!isPasswordCorrect) {
    throw new ApiError(401, 'Invalid credentials');
  }

  // Update last login
  user.lastLogin = new Date();
  await user.save();

  // Generate token
  const token = generateToken(user._id.toString(), user.email, user.role);

  res.status(200).json({
    success: true,
    message: 'Login successful',
    data: {
      user: {
        id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        fullName: user.getFullName(),
        role: user.role,
        lastLogin: user.lastLogin,
      },
      token,
    },
  });
});

/**
 * @desc    Logout user
 * @route   POST /api/auth/logout
 * @access  Private
 */
export const logout = catchAsync(async (req: Request, res: Response) => {
  if (!req.user) {
    throw new ApiError(401, 'Not authenticated');
  }

  // Extract token from Authorization header
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new ApiError(401, 'No token provided');
  }

  const token = authHeader.split(' ')[1];

  // Decode token to get expiration time
  const decoded = jwt.decode(token) as { exp: number };
  
  if (!decoded || !decoded.exp) {
    throw new ApiError(400, 'Invalid token format');
  }

  // Convert expiration timestamp to Date
  const expiresAt = new Date(decoded.exp * 1000);

  // Add token to blacklist
  await TokenBlacklist.create({
    token,
    userId: req.user._id,
    expiresAt,
  });

  res.status(200).json({
    success: true,
    message: 'Logout successful',
  });
});

/**
 * @desc    Get current logged-in user
 * @route   GET /api/auth/me
 * @access  Private
 */
export const getCurrentUser = catchAsync(
  async (req: Request, res: Response) => {
    if (!req.user) {
      throw new ApiError(401, 'Not authenticated');
    }

    res.status(200).json({
      success: true,
      data: {
        user: {
          id: req.user._id,
          email: req.user.email,
          firstName: req.user.firstName,
          lastName: req.user.lastName,
          fullName: req.user.getFullName(),
          role: req.user.role,
          status: req.user.status,
          lastLogin: req.user.lastLogin,
          createdAt: req.user.createdAt,
        },
      },
    });
  }
);

/**
 * @desc    Refresh access token
 * @route   POST /api/auth/refresh
 * @access  Private
 */
export const refreshToken = catchAsync(
  async (req: Request, res: Response) => {
    if (!req.user) {
      throw new ApiError(401, 'Not authenticated');
    }

    // Generate new token
    const token = generateToken(
      req.user._id.toString(),
      req.user.email,
      req.user.role
    );

    res.status(200).json({
      success: true,
      message: 'Token refreshed successfully',
      data: { token },
    });
  }
);

/**
 * @desc    Activate invited admin account
 * @route   POST /api/auth/activate
 * @access  Public
 */
export const activateAccount = catchAsync(
  async (req: Request, res: Response) => {
    const { token, password } = req.body;

    // Find user with valid invite token
    const user = await AdminUser.findOne({
      inviteToken: token,
      inviteTokenExpiry: { $gt: new Date() },
      status: 'pending',
    }).select('+inviteToken +inviteTokenExpiry');

    if (!user) {
      throw new ApiError(400, 'Invalid or expired activation token');
    }

    // Set password and activate account
    user.password = password;
    user.status = 'active';
    user.inviteToken = undefined;
    user.inviteTokenExpiry = undefined;
    await user.save();

    // Generate token
    const authToken = generateToken(
      user._id.toString(),
      user.email,
      user.role
    );

    res.status(200).json({
      success: true,
      message: 'Account activated successfully',
      data: {
        user: {
          id: user._id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          fullName: user.getFullName(),
          role: user.role,
        },
        token: authToken,
      },
    });
  }
);
