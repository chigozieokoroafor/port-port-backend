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
    const errString: string[] = []
    errors.array().forEach((err: any) => {
      errString.push(err.msg)
      extractedErrors.push({
        field: err.path || err.param,
        message: err.msg,
        value: err.value,
      });
    });
    // throw new ApiError(400, 'Validation failed', errors as any);

    // console.log("Errors here retard ===> ")
    // console.dir(errors, { depth: 12 })

    return res.status(400).json({
      success: false,
      message: errString.length > 0 ? errString.toLocaleString() : 'Validation failed',
      errors: extractedErrors,
    });
  }

  next();
};