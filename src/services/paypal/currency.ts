import { ApiError } from '../../utils/ApiError';

/**
 * PayPal-specific amount formatting — the deliberate counterpart to the Stripe
 * module's `currency.ts`, kept separate on purpose (see the note there).
 *
 * PayPal's Orders API wants the amount as a DECIMAL STRING in the currency's major
 * unit — "1500.00" for USD, "150000" for JPY — the opposite of Stripe's integer
 * minor units. A single shared "to provider amount" helper that conflated the two
 * is exactly the bug the integration guide warns against, so PayPal gets its own.
 *
 * The number of decimal places is currency-dependent: zero-decimal currencies must
 * carry NO fractional part (PayPal rejects "150000.00" for JPY), two-decimal
 * currencies must carry exactly two. Three-decimal currencies exist but none are in
 * our supported set, so they're intentionally not handled here.
 * https://developer.paypal.com/api/rest/reference/currency-codes/
 */

// Currencies with no minor unit — the value must be a whole number with no decimals.
// Same set the Stripe converter uses; duplicated rather than shared so the two
// providers' formatting rules stay independent.
const ZERO_DECIMAL_CURRENCIES = new Set([
    'BIF', 'CLP', 'DJF', 'GNF', 'JPY', 'KMF', 'KRW', 'MGA', 'PYG',
    'RWF', 'UGX', 'VND', 'VUV', 'XAF', 'XOF', 'XPF',
]);

// PayPal doesn't support every currency Stripe does. This is the subset of our
// quote currencies that PayPal accepts; anything else is rejected up front with a
// clear message rather than surfacing as an opaque PayPal 4xx mid-order.
// https://developer.paypal.com/api/rest/reference/currency-codes/
const PAYPAL_SUPPORTED_CURRENCIES = new Set([
    'USD', 'EUR', 'GBP', 'CAD', 'AUD', 'JPY',
]);

/**
 * Format a human-facing amount (e.g. 1500) as the decimal string PayPal expects for
 * the given currency ("1500.00" / "150000"). Throws on an unsupported currency.
 */
export const toPayPalAmount = (amount: number, currency: string): string => {
    const code = currency.toUpperCase();

    if (!PAYPAL_SUPPORTED_CURRENCIES.has(code)) {
        throw new ApiError(400, `PayPal does not support ${currency}; please pay by card`);
    }

    const decimals = ZERO_DECIMAL_CURRENCIES.has(code) ? 0 : 2;
    // toFixed rounds and fixes the decimal count, avoiding float artifacts such as
    // 19.99 producing "19.990000001".
    return amount.toFixed(decimals);
};

/**
 * Inverse of toPayPalAmount — turn a PayPal decimal-string amount back into a Number
 * for the confirmation email. Returns NaN-safe 0 on a malformed value rather than
 * throwing, since this runs inside webhook fulfillment where the payment is already real.
 */
export const fromPayPalAmount = (value: string | undefined): number => {
    const n = Number.parseFloat(value ?? '');
    return Number.isFinite(n) ? n : 0;
};
