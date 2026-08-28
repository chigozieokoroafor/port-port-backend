/**
 * Which payment provider a Payment record was created through.
 *
 * Stored on every Payment so a single collection can hold both Stripe- and
 * PayPal-originated payments. The model defaults this to `Stripe`, so every record
 * written before PayPal existed is implicitly correct without a backfill migration.
 */
export enum PaymentProvider {
    Stripe = 'stripe',
    Paypal = 'paypal',
}
