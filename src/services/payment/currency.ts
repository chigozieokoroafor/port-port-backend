/**
 * Stripe-specific currency conversion (guide 1.8).
 *
 * Deliberately NOT a shared, provider-agnostic "convert to provider format" helper:
 * Stripe wants integer minor units, PayPal wants a decimal string, and a single
 * helper that conflates the two is the exact bug the integration guide warns about
 * (Part 3). If PayPal is added later it gets its own converter next to its own client.
 *
 * Zero-decimal currencies (JPY, KRW, …) are already expressed in their whole unit,
 * so multiplying by 100 would overcharge by 100x. This list is Stripe's published set.
 * https://docs.stripe.com/currencies#zero-decimal
 */
const ZERO_DECIMAL_CURRENCIES = new Set([
    'BIF', 'CLP', 'DJF', 'GNF', 'JPY', 'KMF', 'KRW', 'MGA', 'PYG',
    'RWF', 'UGX', 'VND', 'VUV', 'XAF', 'XOF', 'XPF',
]);

/**
 * Convert a human-facing decimal amount (e.g. 49.99) into the integer minor units
 * Stripe expects (e.g. 4999, or 50 for a zero-decimal currency like JPY).
 * Rounds to avoid float artifacts such as 19.99 * 100 = 1998.9999...
 */
export const toMinorUnits = (amount: number, currency: string): number => {
    if (ZERO_DECIMAL_CURRENCIES.has(currency.toUpperCase())) {
        return Math.round(amount);
    }
    return Math.round(amount * 100);
};

/**
 * Inverse of toMinorUnits — turn a Stripe minor-unit amount back into the display
 * amount. Used when echoing `amount_total` from a webhook into a confirmation email.
 */
export const fromMinorUnits = (minorUnits: number, currency: string): number => {
    if (ZERO_DECIMAL_CURRENCIES.has(currency.toUpperCase())) {
        return minorUnits;
    }
    return minorUnits / 100;
};
