/**
 * Payment methods a customer can select on the order-preview page (guide §1).
 *
 * These are OUR internal identifiers, sent in the create-payment payload — not a
 * provider's own method strings. `card` and `bank_transfer` are fulfilled through
 * Stripe (the translation to Stripe `payment_method_type`s lives in the payment
 * service — see `resolvePaymentMethodTypes`). `paypal` is fulfilled through PayPal's
 * own hosted redirect flow (see the paypal service), so it selects the PROVIDER,
 * not a Stripe method type. `create()` branches on that distinction.
 */
export enum PaymentMethod {
    Card = 'card',
    BankTransfer = 'bank_transfer',
    Paypal = 'paypal',
    Stripe = 'stripe'
}
