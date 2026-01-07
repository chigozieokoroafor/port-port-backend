import { Request, Response, NextFunction } from 'express';
import { ApiError } from '../utils/ApiError';

/**
 * Handle 404 - Route not found
 */
export const notFound = (req: Request, res: Response, next: NextFunction) => {
  const error = new ApiError(
    404,
    `Route not found - ${req.method} - ${req.originalUrl}`
  );
  next(error);
};