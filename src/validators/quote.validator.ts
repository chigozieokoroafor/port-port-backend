import { body, param } from 'express-validator';
import { VehicleType } from '../models/enums/VehicleType.enum';
import { VehicleCondition } from '../models/enums/VehicleCondition.enum';

/**
 * Validate quote request submission
 */
export const validateQuoteRequest = [
    // Customer information
    body('customer.fullName')
        .trim()
        .notEmpty()
        .withMessage('Full name is required')
        .isLength({ min: 2, max: 100 })
        .withMessage('Full name must be between 2 and 100 characters'),
    
    body('customer.email')
        .trim()
        .isEmail()
        .withMessage('Please provide a valid email')
        .normalizeEmail(),
    
    body('customer.phone')
        .trim()
        .notEmpty()
        .withMessage('Phone number is required')
        .matches(/^[+]?[(]?[0-9]{1,4}[)]?[-\s\.]?[(]?[0-9]{1,4}[)]?[-\s\.]?[0-9]{1,9}$/)
        .withMessage('Please provide a valid phone number'),
    
    body('customer.companyName')
        .optional()
        .trim()
        .isLength({ max: 100 })
        .withMessage('Company name must not exceed 100 characters'),
    
    // Vehicle information
    body('vehicle.type')
        .notEmpty()
        .withMessage('Vehicle type is required')
        .isIn(Object.values(VehicleType)) 
        .withMessage('Invalid vehicle type'),
    
    body('vehicle.make')
        .trim()
        .notEmpty()
        .withMessage('Vehicle make is required')
        .isLength({ min: 2, max: 50 })
        .withMessage('Vehicle make must be between 2 and 50 characters'),
    
    body('vehicle.model')
        .trim()
        .notEmpty()
        .withMessage('Vehicle model is required')
        .isLength({ min: 1, max: 50 })
        .withMessage('Vehicle model must be between 1 and 50 characters'),
    
    body('vehicle.year')
        .isInt({ min: 1900, max: new Date().getFullYear() + 1 })
        .withMessage(`Vehicle Year must be between 1900 and ${new Date().getFullYear() + 1}`),
    
    body('vehicle.vin')
        .trim()
        .notEmpty()
        .withMessage('VIN/Chassis number is required')
        .isLength({ min: 5, max: 25 })
        .withMessage('VIN must be between 5 and 25 characters'),
    
    body('vehicle.dimensions.length')
        .isFloat({ min: 0 })
        .withMessage('Vehicle length must be a positive number'),
    
    body('vehicle.dimensions.width')
        .isFloat({ min: 0 })
        .withMessage('Vehicle width must be a positive number'),
    
    body('vehicle.dimensions.height')
        .isFloat({ min: 0 })
        .withMessage('Vehicle height must be a positive number'),
    
    body('vehicle.weight')
        .isFloat({ min: 0 })
        .withMessage('Vehicle weight must be a positive number'),
    
    body('vehicle.condition')
        .notEmpty()
        .withMessage('Vehicle condition is required')
        .isIn(Object.values(VehicleCondition)) 
        .withMessage('Condition must be either running or non-running'),
    
    // Route information
    body('route.originCountry')
        .trim()
        .notEmpty()
        .withMessage('Origin country is required')
        .isLength({ min: 2, max: 100 })
        .withMessage('Origin country must be between 2 and 100 characters'),
    
    body('route.originPort')
        .trim()
        .notEmpty()
        .withMessage('Origin port is required')
        .isLength({ min: 2, max: 100 })
        .withMessage('Origin port must be between 2 and 100 characters'),
    
    body('route.destinationCountry')
        .trim()
        .notEmpty()
        .withMessage('Destination country is required')
        .isLength({ min: 2, max: 100 })
        .withMessage('Destination country must be between 2 and 100 characters'),
    
    body('route.destinationPort')
        .trim()
        .notEmpty()
        .withMessage('Destination port is required')
        .isLength({ min: 2, max: 100 })
        .withMessage('Destination port must be between 2 and 100 characters'),
    
    body('route.preferredShippingDate')
        .optional()
        .isISO8601()
        .withMessage('Please provide a valid date'),
];

/**
 * Validate generate quote request
 */
export const validateGenerateQuote = [
    param('requestId')
        .isMongoId()
        .withMessage('Invalid quote request ID'),
    
    body('pricing.shippingCost')
        .isFloat({ min: 0 })
        .withMessage('Shipping cost must be a positive number'),
    
    body('pricing.insuranceCost')
        .optional()
        .isFloat({ min: 0 })
        .withMessage('Insurance cost must be a positive number'),
    
    body('pricing.handlingFees')
        .optional()
        .isFloat({ min: 0 })
        .withMessage('Handling fees must be a positive number'),
    
    body('pricing.additionalCharges')
        .optional()
        .isArray()
        .withMessage('Additional charges must be an array'),
    
    body('pricing.additionalCharges.*.description')
        .if(body('pricing.additionalCharges').exists())
        .trim()
        .notEmpty()
        .withMessage('Charge description is required'),
    
    body('pricing.additionalCharges.*.amount')
        .if(body('pricing.additionalCharges').exists())
        .isFloat({ min: 0 })
        .withMessage('Charge amount must be a positive number'),
    
    body('pricing.totalAmount')
        .isFloat({ min: 0 })
        .withMessage('Total amount must be a positive number'),
    
    body('pricing.currency')
        .optional()
        .isLength({ min: 3, max: 3 })
        .withMessage('Currency must be a 3-letter code')
        .isUppercase()
        .withMessage('Currency must be uppercase'),
    
    body('terms.validUntil')
        .isISO8601()
        .withMessage('Please provide a valid validity date')
        .custom((value) => {
        if (new Date(value) <= new Date()) {
            throw new Error('Validity date must be in the future');
        }
        return true;
        }),
    
    body('terms.paymentTerms')
        .trim()
        .notEmpty()
        .withMessage('Payment terms are required')
        .isLength({ min: 10, max: 500 })
        .withMessage('Payment terms must be between 10 and 500 characters'),
    
    body('terms.specialConditions')
        .optional()
        .trim()
        .isLength({ max: 1000 })
        .withMessage('Special conditions must not exceed 1000 characters'),
];

/**
 * Validate update quote request
 */
export const validateUpdateQuote = [
    param('id')
        .isMongoId()
        .withMessage('Invalid quote ID'),
    
    body('pricing.shippingCost')
        .optional()
        .isFloat({ min: 0 })
        .withMessage('Shipping cost must be a positive number'),
    
    body('pricing.insuranceCost')
        .optional()
        .isFloat({ min: 0 })
        .withMessage('Insurance cost must be a positive number'),
    
    body('pricing.handlingFees')
        .optional()
        .isFloat({ min: 0 })
        .withMessage('Handling fees must be a positive number'),
    
    body('pricing.totalAmount')
        .optional()
        .isFloat({ min: 0 })
        .withMessage('Total amount must be a positive number'),
    
    body('pricing.currency')
        .optional()
        .isLength({ min: 3, max: 3 })
        .withMessage('Currency must be a 3-letter code'),
    
    body('terms.validUntil')
        .optional()
        .isISO8601()
        .withMessage('Please provide a valid validity date'),
    
    body('terms.paymentTerms')
        .optional()
        .trim()
        .isLength({ min: 10, max: 500 })
        .withMessage('Payment terms must be between 10 and 500 characters'),
    
    body('terms.specialConditions')
        .optional()
        .trim()
        .isLength({ max: 1000 })
        .withMessage('Special conditions must not exceed 1000 characters'),
];

/**
 * Validate update status request
 */
export const validateUpdateStatus = [
    param('id')
        .isMongoId()
        .withMessage('Invalid quote request ID'),
    
    body('notes')
        .optional()
        .trim()
        .isLength({ max: 1000 })
        .withMessage('Notes must not exceed 1000 characters'),
];