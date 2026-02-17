import { Request, Response, NextFunction } from 'express';
import { ApiError } from '../utils/ApiError';
import { UserType } from '../models/enums/UserType.enum';
import User from '../models/User.model';

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

  if (req.user.role !== UserType.SuperAdmin) {
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

  if (req.user.role !== UserType.Admin && req.user.role !== UserType.SuperAdmin) {
    throw new ApiError(
      403,
      'Access denied. Admin privileges required.'
    );
  }

  next();
};

function isValidRole(role: UserType): role is UserType.Admin | UserType.SuperAdmin {
  return role === UserType.Admin || role === UserType.SuperAdmin;
}

/**
 * Allow multiple roles
 */
export const restrictTo = (...roles: (UserType.Admin| UserType.SuperAdmin)[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      throw new ApiError(401, 'Not authenticated');
    }

    if (!isValidRole(req.user.role)) {
      throw new ApiError(
        403,
        `Access denied. Required role: ${roles.join(' or ')}`
      );
    }

    next();
  };
};
