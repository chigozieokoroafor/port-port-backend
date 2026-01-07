import { Request, Response, NextFunction } from 'express';
import { ApiError } from '../utils/ApiError';

/**
 * Restrict access to SuperAdmin only
 */
export const restrictToSuperAdmin = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  if (!req.user) {
    throw new ApiError(401, 'Not authenticated');
  }

  if (req.user.role !== 'superadmin') {
    throw new ApiError(
      403,
      'Access denied. SuperAdmin privileges required.'
    );
  }

  next();
};

/**
 * Restrict access to Admin or SuperAdmin
 */
export const restrictToAdmin = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  if (!req.user) {
    throw new ApiError(401, 'Not authenticated');
  }

  if (req.user.role !== 'admin' && req.user.role !== 'superadmin') {
    throw new ApiError(
      403,
      'Access denied. Admin privileges required.'
    );
  }

  next();
};

/**
 * Allow multiple roles
 */
export const restrictTo = (...roles: ('admin' | 'superadmin')[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      throw new ApiError(401, 'Not authenticated');
    }

    if (!roles.includes(req.user.role)) {
      throw new ApiError(
        403,
        `Access denied. Required role: ${roles.join(' or ')}`
      );
    }

    next();
  };
};
