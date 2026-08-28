/**
 * The PayPal webhook event types this integration acts on.
 *
 * PayPal emits many more; these are the only ones we handle. Anything else is
 * acknowledged (200) so PayPal stops retrying, but does no work — same policy as
 * the Stripe webhook's `default` branch.
 */
export enum PayPalWebhookEvent {
    // Money captured and settled — the ONLY trustworthy "paid" signal. Triggers the
    // Unpaid→Paid flip, shipment creation, and the confirmation email.
    CaptureCompleted = 'PAYMENT.CAPTURE.COMPLETED',
    // Capture was attempted but declined/denied — mark the payment Failed.
    CaptureDenied = 'PAYMENT.CAPTURE.DENIED',
    // Buyer approved on PayPal's hosted page but hasn't been captured yet. Recorded
    // for visibility into the approve-then-abandon gap; not a completed payment.
    OrderApproved = 'CHECKOUT.ORDER.APPROVED',
}
