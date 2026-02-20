import { Request, Response, NextFunction } from 'express';
import { validationResult } from 'express-validator';

/**
 * Middleware to check validation results from express-validator
 */
export const validate = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    const extractedErrors: any[] = [];
    
    errors.array().forEach((err: any) => {
      extractedErrors.push({
        field: err.path || err.param,
        message: err.msg,
        value: err.value,
      });
    });
    // throw new ApiError(400, 'Validation failed', errors as any);

    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: extractedErrors,
    });
  }

  next();
};