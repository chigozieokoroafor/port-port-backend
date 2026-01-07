import rateLimit from 'express-rate-limit';
import { Request, Response } from 'express';

/**
 * Create a rate limiter with custom options
 */
export const rateLimiter = (options?: {
  windowMs?: number;
  max?: number;
  message?: string;
}) => {
  return rateLimit({
    windowMs: options?.windowMs || 15 * 60 * 1000, // 15 minutes default
    max: options?.max || 100, // Limit each IP to 100 requests per windowMs
    message: options?.message || 'Too many requests, please try again later',
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
    handler: (req: Request, res: Response) => {
      res.status(429).json({
        success: false,
        message: options?.message || 'Too many requests, please try again later',
      });
    },
  });
};

/**
 * Strict rate limiter for sensitive operations
 */
export const strictRateLimiter = rateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 requests per 15 minutes
  message: 'Too many attempts, please try again after 15 minutes',
});

/**
 * General API rate limiter
 */
export const apiRateLimiter = rateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests per 15 minutes
});
