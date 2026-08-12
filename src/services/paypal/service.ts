import { randomUUID } from 'node:crypto';
import {
    CheckoutPaymentIntent,
    Order,
    OrderStatus,
    PaypalExperienceUserAction,
} from '@paypal/paypal-server-sdk';
import { IQuote } from '../../models/Quote.model';
import { ApiError } from '../../utils/ApiError';
import { getOrdersController } from './client';
import { toPayPalAmount } from './currency';

/**
 * PayPal order creation + capture — the PayPal counterpart to the Stripe module's
 * `createCheckoutSession`. Standard redirect flow: create an order, hand the buyer
 * the `approve` link, capture once they've approved on PayPal's hosted page.
 *
 * Deliberately mirrors the Stripe service's shape and guarantees:
 * - the quote reference travels on the order's `customId`, so it comes back on both
 *   the capture response and the webhook (PayPal's analogue of Stripe's
 *   `client_reference_id`/`metadata`);
 * - a per-call idempotency key (`paypalRequestId`) protects the create call against a
 *   transient network retry creating two orders, unique per invocation so a
 *   deliberate re-generation still yields a fresh order (matching the Stripe key policy).
 */

/** Pull the buyer-facing approval URL out of an order's HATEOAS links. */
const extractApprovalUrl = (order: Order): string => {
    const approve = order.links?.find((l) => l.rel === 'approve' || l.rel === 'payer-action');
    if (!approve?.href) {
        throw new ApiError(502, 'PayPal did not return an approval link for the order');
    }
    return approve.href;
};

export interface CreatedPayPalOrder {
    orderId: string;
    approvalUrl: string;
}

/**
 * Create a capture-intent PayPal order for a quote and return the order id plus the
 * approval URL the frontend redirects the buyer to. The return/cancel URLs are built
 * and supplied by us (same principle as Stripe's success/cancel URLs) via the modern
 * `paymentSource.paypal.experienceContext` fields (not the deprecated applicationContext).
 */
export const createPayPalOrder = async (
    quote: IQuote,
    returnUrl: string,
    cancelUrl: string,
): Promise<CreatedPayPalOrder> => {
    const currency = quote.pricing.currency?.toUpperCase();
    if (!currency) {
        throw new ApiError(400, `Unsupported currency: ${quote.pricing.currency}`);
    }

    // toPayPalAmount validates the currency is one PayPal supports and formats it
    // to the correct decimal precision.
    const value = toPayPalAmount(quote.pricing.totalAmount, currency);

    const { result, statusCode } = await getOrdersController().createOrder({
        body: {
            intent: CheckoutPaymentIntent.Capture,
            purchaseUnits: [
                {
                    // Our quote reference — comes back on capture + webhook for reconciliation.
                    customId: quote.quoteNumber,
                    description: quote.quoteNumber,
                    amount: {
                        currencyCode: currency,
                        value,
                    },
                },
            ],
            paymentSource: {
                paypal: {
                    experienceContext: {
                        returnUrl,
                        cancelUrl,
                        // "PAY_NOW" so the buyer completes payment on PayPal rather than
                        // being bounced back to us to press pay again.
                        userAction: PaypalExperienceUserAction.PayNow,
                        brandName: 'Port2Port',
                    },
                },
            },
        },
        prefer: 'return=representation',
        paypalRequestId: randomUUID(),
    });

    if (statusCode >= 400 || !result?.id) {
        throw new ApiError(502, 'Failed to create PayPal order');
    }

    return {
        orderId: result.id,
        approvalUrl: extractApprovalUrl(result),
    };
};

export interface CapturedPayPalOrder {
    status: OrderStatus | undefined;
    captureId?: string;
    quoteReference?: string;
    currency?: string;
    amount?: string;
    alreadyCaptured: boolean;
}

/**
 * Capture an approved PayPal order. Returns the settled capture details pulled out of
 * the nested purchase-unit response.
 *
 * Idempotency: capturing an order that PayPal has already captured returns a 422 with
 * issue `ORDER_ALREADY_CAPTURED`. That is not an error for us — the money is captured,
 * which is the goal — so we swallow it and report `alreadyCaptured: true`, letting the
 * double-return-hit case (back button + reload) resolve gracefully. Any other failure
 * propagates.
 */
export const capturePayPalOrder = async (orderId: string): Promise<CapturedPayPalOrder> => {
    try {
        const { result } = await getOrdersController().captureOrder({
            id: orderId,
            prefer: 'return=representation',
        });

        const unit = result.purchaseUnits?.[0];
        const capture = unit?.payments?.captures?.[0];

        return {
            status: result.status,
            captureId: capture?.id,
            quoteReference: unit?.customId ?? capture?.customId,
            currency: capture?.amount?.currencyCode,
            amount: capture?.amount?.value,
            alreadyCaptured: false,
        };
    } catch (err: any) {
        // The SDK throws its own ApiError on non-2xx. Detect the already-captured
        // case from the body so a repeat capture is a no-op rather than a 500.
        const body = typeof err?.body === 'string' ? err.body : JSON.stringify(err?.body ?? '');
        if (err?.statusCode === 422 && body.includes('ORDER_ALREADY_CAPTURED')) {
            return { status: OrderStatus.Completed, alreadyCaptured: true };
        }
        throw err;
    }
};
