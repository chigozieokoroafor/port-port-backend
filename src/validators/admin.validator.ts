import { body, param } from 'express-validator';
import { UserType } from '../models/enums/UserType.enum';

/**
 * Validate invite admin request
 */
export const validateInviteAdmin = [
    body('email')
        .trim()
        .isEmail()
        .withMessage('Please provide a valid email')
        .normalizeEmail(),
    body('firstName')
        .trim()
        .notEmpty()
        .withMessage('First name is required')
        .isLength({ min: 2, max: 50 })
        .withMessage('First name must be between 2 and 50 characters'),
    body('lastName')
        .trim()
        .notEmpty()
        .withMessage('Last name is required')
        .isLength({ min: 2, max: 50 })
        .withMessage('Last name must be between 2 and 50 characters'),
    body('role')
        .optional()
        .isIn([UserType.Admin, UserType.SuperAdmin])
        .withMessage('Role must be either admin or superadmin'),
];

/**
 * Validate update admin request
 */
export const validateUpdateAdmin = [
    param('id')
        .isMongoId()
        .withMessage('Invalid admin user ID'),
    body('firstName')
        .optional()
        .trim()
        .isLength({ min: 2, max: 50 })
        .withMessage('First name must be between 2 and 50 characters'),
    body('lastName')
        .optional()
        .trim()
        .isLength({ min: 2, max: 50 })
        .withMessage('Last name must be between 2 and 50 characters'),
    body('role')
        .optional()
        .isIn(['admin', 'superadmin'])
        .withMessage('Role must be either admin or superadmin'),
    body('status')
        .optional()
        .isIn(['pending', 'active', 'suspended'])
        .withMessage('Status must be pending, active, or suspended'),
];