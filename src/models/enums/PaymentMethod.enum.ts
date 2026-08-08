/**
 * Payment methods a customer can select on the order-preview page (guide §1).
 *
 * These are OUR internal identifiers, sent in the create-payment payload — not
 * Stripe's own `payment_method_type` strings. The translation from these to the
 * concrete Stripe types enabled on a Checkout Session lives in the payment
 * service (see `resolvePaymentMethodTypes`).
 */
export enum PaymentMethod {
    Card = 'card',
    BankTransfer = 'bank_transfer',
}
