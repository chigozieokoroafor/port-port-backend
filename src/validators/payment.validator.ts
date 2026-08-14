import { body } from 'express-validator';
import { PaymentMethod } from '../models/enums/PaymentMethod.enum';

/**
 * Validate the create-checkout-session payload (guide §2.1).
 *
 * The payload must carry a valid quote id and a supported payment-method
 * selection before any Stripe-facing code runs, so malformed or incomplete
 * requests are rejected up front rather than surfacing as opaque errors deeper
 * in the flow.
 */
export const validateCreatePayment = [
    body('quoteId')
        .notEmpty()
        .withMessage('quoteId is required')
        .isMongoId()
        .withMessage('Invalid quote ID'),

    body('paymentMethod')
        .notEmpty()
        .withMessage('paymentMethod is required')
        .isIn(Object.values(PaymentMethod))
        .withMessage('paymentMethod must be one of: card, bank_transfer, paypal'),
];
