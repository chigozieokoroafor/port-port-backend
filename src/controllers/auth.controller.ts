import { Request, Response } from 'express';
import jwt, { SignOptions } from 'jsonwebtoken';
import crypto from 'crypto';
import User from '../models/User.model';
import TokenBlacklist from '../models/TokenBlacklist.model';
import { ApiError } from '../utils/ApiError';
import { catchAsync } from '../utils/catchAsync';
import { sendPasswordResetEmail } from '../services/email/service';
import { UserStatus } from '../models/enums/UserStatus.enum';
import { emailVerification, sendResetPassword, sendTestEmail } from '../services/email.service';
import Token from '../models/Token.model';
import moment from 'moment';

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
 * @desc    Create User customer
 * @route   POST /api/auth/create
 * @access  Public
 */

export const create = catchAsync(async (req: Request, res: Response) => {
  const { firstName, lastName, email, password, isAgreedToTermsAndConditions, isSubscribedToNewsletter } = req.body;
  let user = await User.findOne({
    email: req.body.email
  })
  if (user) {
    throw new ApiError(400, 'User with email already exist');
  }
  user = await User.create({
    firstName,
    lastName,
    email,
    password,
    status: UserStatus.Pending,
    isAgreedToTermsAndConditions,
    isSubscribedToNewsletter
  });

  await emailVerification(user);

  return res.status(200).json({
    success: true,
    message: 'User created successfully',
    data: {
      user: {
        id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        fullName: user.getFullName()
      }
    }
  });
});

/**
 * @desc    Login admin/superadmin
 * @route   POST /api/auth/login
 * @access  Public
 */
export const login = catchAsync(async (req: Request, res: Response) => {
  const { email, password } = req.body;

  // Check if user exists (with password field)
  const user = await User.findOne({ email }).select('+password');

  if (!user) {
    throw new ApiError(401, 'Invalid credentials');
  }

  // Check if account is active
  if (user.status === UserStatus.Suspended) {
    throw new ApiError(403, 'Your account has been suspended');
  }

  if (user.status === UserStatus.Pending) {
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


export const verifyEmail = catchAsync(async (req: Request, res: Response) => {
  const token = await Token.findOne({
    hash: req.params.hash
  });
  if (token === null || !token) {
    throw new ApiError(400, 'invalid token');
  }

  if (moment().isAfter(moment(token.expiresIn))) {
    throw new ApiError(400, 'Token expired')
  }

  const user = await User.findOneAndUpdate({
    _id: token.user
  }, {
    status: UserStatus.Active
  });
  return res.status(200).json({ success: true, message: 'User verified successfully' })
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
    const { password } = req.body;

    const token = await Token.findOne({
      hash: req.params.hash
    });
    if (token === null || !token) {
      throw new ApiError(400, 'invalid token');
    }

    if (moment().isAfter(moment(token.expiresIn))) {
      throw new ApiError(400, 'Token expired')
    }

    // Find user with valid invite token
    const user = await User.findOne({
      _id: token.user
    })

    if(!user){
      throw new ApiError(400, 'User does not exist')
    }


    // Set password and activate account
    user.password = password;
    user.status = UserStatus.Active;
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

/**
 * @desc    Change password (when user is logged in)
 * @route   PUT /api/auth/change-password
 * @access  Private
 */
export const changePassword = catchAsync(
  async (req: Request, res: Response) => {
    const { currentPassword, newPassword } = req.body;

    if (!req.user) {
      throw new ApiError(401, 'Not authenticated');
    }

    // Get user with password
    const user = await User.findById(req.user._id).select('+password');

    if (!user) {
      throw new ApiError(404, 'User not found');
    }

    // Verify current password
    const isPasswordCorrect = await user.comparePassword(currentPassword);

    if (!isPasswordCorrect) {
      throw new ApiError(401, 'Current password is incorrect');
    }

    // Update password
    user.password = newPassword;
    await user.save();

    res.status(200).json({
      success: true,
      message: 'Password changed successfully',
    });
  }
);

/**
 * @desc    Forgot password - send reset email
 * @route   POST /api/auth/forgot-password
 * @access  Public
 */
export const forgotPassword = catchAsync(
  async (req: Request, res: Response) => {
    const { email } = req.body;

    // Find user by email
    const user = await User.findOne({ email });

    if (!user) {
      // Don't reveal that user doesn't exist for security
      return res.status(200).json({
        success: true,
        message: 'If an account exists with this email, a password reset link has been sent',
      });
    }

    // Check if user is active
    if (user.status !== UserStatus.Active) {
      throw new ApiError(403, 'Account is not active');
    }


    try {
      // Send email
      await sendResetPassword(user);

      res.status(200).json({
        success: true,
        message: 'Password reset link sent to your email',
      });
    } catch (error) {
      throw new ApiError(500, 'Failed to send password reset email. Please try again.');
    } 
  }
);

/**
 * @desc    Reset password with token
 * @route   POST /api/auth/reset-password
 * @access  Public
 */
export const resetPassword = catchAsync(
  async (req: Request, res: Response) => {
    const { newPassword } = req.body;

    const token = await Token.findOne({
      hash: req.params.hash
    });

    if (token === null || !token) {
      throw new ApiError(400, 'invalid token');
    }

    if (moment().isAfter(moment(token.expiresIn))) {
      throw new ApiError(400, 'Token expired')
    }

    const user = await User.findOne({
      _id: token.user
    });

    if (!user) {
      throw new ApiError(400, 'Invalid user')
    }

    // Update password
    user.password = newPassword;
    await user.save();

    // Generate new auth token
    const authToken = generateToken(
      user._id.toString(),
      user.email,
      user.role
    );

    res.status(200).json({
      success: true,
      message: 'Password reset successfully',
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
