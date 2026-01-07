import { Request, Response, NextFunction } from 'express';
import { ApiError } from '../utils/ApiError';
import logger from '../utils/logger';

export const errorHandler = (
    err: Error, req: Request, res: Response, next: NextFunction
) => {
    logger.error(err);

    if (err instanceof ApiError) {
        return res.status(err.statusCode).json({ success: false, message: err.message });
    }

    // Mongoose validation error
    if (err.name === 'ValidationError') {
        return res.status(400).json({ success: false, message: 'Validation Error', errors: err.message });
    }

    // Mongoose duplicate key error
    if (err.name === 'MongoError' && (err as any).code === 11000) {
        return res.status(400).json({ success: false, message: 'Duplicate field value' });
    }

    // JWT errors
    if (err.name === 'JsonWebTokenError') {
        return res.status(401).json({ success: false, message: 'Invalid token' });
    }

    if (err.name === 'TokenExpiredError') {
        return res.status(401).json({ success: false, message: 'Token expired' });
    }

    // Default error
    res.status(500).json({
        success: false,
        message: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message
    });
};