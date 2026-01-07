import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import AdminUser, { IAdminUser } from '../models/AdminUser.model';
import { ApiError } from '../utils/ApiError';
import { catchAsync } from '../utils/catchAsync';


declare global {
  namespace Express {
    interface Request {
      user?: IAdminUser;
    }
  }
}

interface JwtPayload {
  id: string;
  email: string;
  role: 'admin' | 'superadmin';
}

/**
 * Protect routes - Verify JWT token
 */
export const protect = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    let token: string | undefined;

    // Check for token in Authorization header
    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith('Bearer')
    ) {
      token = req.headers.authorization.split(' ')[1];
    }

    // Check if token exists
    if (!token) {
      throw new ApiError(401, 'Not authorized to access this route');
    }

    try {
      // Verify token
      const decoded = jwt.verify(
        token,
        process.env.JWT_SECRET as string
      ) as JwtPayload;

      // Get user from database
      const user = await AdminUser.findById(decoded.id);

      if (!user) {
        throw new ApiError(401, 'User no longer exists');
      }

      // Check if user is active
      if (user.status !== 'active') {
        throw new ApiError(
          403,
          'Your account is not active. Please contact support.'
        );
      }

      // Attach user to request object
      req.user = user;

      next();
    } catch (error: any) {
      if (error.name === 'JsonWebTokenError') {
        throw new ApiError(401, 'Invalid token');
      }
      if (error.name === 'TokenExpiredError') {
        throw new ApiError(401, 'Token expired');
      }
      throw error;
    }
  }
);

/**
 * Optional auth - Attach user if token is valid, but don't require it
 */
export const optionalAuth = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    let token: string | undefined;

    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith('Bearer')
    ) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (token) {
      try {
        const decoded = jwt.verify(
          token,
          process.env.JWT_SECRET as string
        ) as JwtPayload;

        const user = await AdminUser.findById(decoded.id);

        if (user && user.status === 'active') {
          req.user = user;
        }
      } catch (error) {
        // Token invalid, but that's okay for optional auth
        // Continue without attaching user
      }
    }

    next();
  }
);
