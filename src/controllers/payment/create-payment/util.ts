import { Request, Response } from 'express';
import Payment from '../../../models/Payment.model';
import { PaymentStatus } from '../../../models/enums/PaymentStatus.enum';
import { PaymentProvider } from '../../../models/enums/PaymentProvider.enum';
import { IPayment } from '../../../models/interfaces/Payment.interface';
import { IQuote } from '../../../models/Quote.model';
// import { createPayPalOrder, capturePayPalOrder } from '../../../services/paypal';
import logger from '../../../utils/logger';
import { Client, Environment, OrdersController } from '@paypal/paypal-server-sdk';
import { randomUUID } from 'node:crypto';
import {
    CheckoutPaymentIntent,
    Order,
    OrderStatus,
    PaypalExperienceUserAction,
} from '@paypal/paypal-server-sdk';
// import { IQuote } from '../../models/Quote.model';
import { ApiError } from '../../../utils/ApiError';
// import { getOrdersController } from './client';
// import { toPayPalAmount } from './currency';


/**
 * PayPal branch of `create` (guide Phase 2 section 2). Runs after the shared front-half
 * (quote lookup, ownership, approval, already-paid guard) has passed.
 *
 * Mirrors the Stripe branch's persist-then-respond contract: create the PayPal order,
 * store a Payment record (provider `paypal`, `paypalOrderId`, Unpaid) BEFORE returning,
 * then hand the frontend the approval URL to redirect to. As with Stripe, no email or
 * shipment happens here — the webhook (PAYMENT.CAPTURE.COMPLETED) is the source of truth.
 */
export const createPayPalPayment = async (
    req: Request,
    res: Response,
    quote: IQuote,
    existing: IPayment | null,
): Promise<Response> => {
    // Return/cancel URLs are built by us, same principle as the Stripe success/cancel
    // URLs. The return URL carries the quote ref so the return handler can look up the
    // record; PayPal also appends `?token=<orderId>` on redirect.
    const frontendUrl = process.env.FRONTEND_URL as string;
    const returnUrl = `${process.env.BACKEND_URL}/api/payment/paypal/return?quoteRef=${quote.quoteNumber}`;
    const cancelUrl = `${frontendUrl}/payment/cancel?quoteRef=${quote.quoteNumber}`;

    const { orderId, approvalUrl } = await createPayPalOrder(quote, returnUrl, cancelUrl);

    // Same atomic find-or-create keyed on the unique `quoteReference` as the Stripe
    // branch, so concurrent inits converge on one record. The order id is stored
    // immediately so a refund/dispute/support lookup can find it even if the buyer
    // never returns from PayPal.
    let payment: IPayment | null;
    try {
        payment = await Payment.findOneAndUpdate(
            { quoteReference: quote.quoteNumber },
            {
                $set: {
                    provider: PaymentProvider.Paypal,
                    paymentUrl: approvalUrl,
                    paypalOrderId: orderId,
                    // Lock the expected amount + currency from the quote at creation time.
                    // Webhook fulfillment verifies the captured money against these.
                    expectedAmount: quote.pricing.totalAmount,
                    expectedCurrency: quote.pricing.currency?.toUpperCase(),
                    updatedBy: req.user?._id,
                },
                $setOnInsert: {
                    quoteId: quote._id,
                    createdBy: req.user?._id,
                    quoteReference: quote.quoteNumber,
                    status: PaymentStatus.Unpaid,
                },
            },
            { new: true, upsert: true }
        );
    } catch (err: any) {
        if (err?.code === 11000) {
            payment = await Payment.findOne({ quoteReference: quote.quoteNumber });
        } else {
            throw err;
        }
    }

    if (existing?.paypalOrderId && existing.paypalOrderId !== orderId) {
        // A prior PayPal order for this quote is being superseded. PayPal orders expire
        // on their own (no explicit cancel call in the SDK), and the webhook/return
        // handlers are scoped so a stale order can't flip the fresh record — so this is
        // just logged for traceability, mirroring the Stripe expire-old-session step.
        logger.info(`Superseding previous PayPal order ${existing.paypalOrderId} for quote ${quote.quoteNumber}`);
    }

    return res.status(200).json({
        success: true,
        message: 'PayPal order created',
        provider: PaymentProvider.Paypal,
        approvalUrl,
        orderId,
    });
};

/**
 * Single shared PayPal SDK client — the PayPal counterpart to `services/payment/stripe.ts`.
 *
 * Credentials come from the environment (never hard-coded), same discipline as the
 * Stripe secret key. The SDK's OAuth manager handles fetching and refreshing the
 * access token from these client credentials, so callers just use the controllers.
 *
 * Environment is chosen by NODE_ENV: real 'production' talks to PayPal Live, anything
 * else (development/test) talks to the Sandbox. This mirrors how the Stripe key's
 * `sk_test_`/`sk_live_` prefix already separates the two worlds — one code path, the
 * surrounding config decides which PayPal it points at.
 *
 * Initialization is LAZY: the client is built on first use, not at import time. This
 * lets the app boot for a Stripe-only deployment (no PayPal credentials configured)
 * while still failing loudly the moment a PayPal payment is actually attempted, rather
 * than crashing the whole server — including Stripe — because one optional provider's
 * credentials are absent.
 */
let controller: OrdersController | undefined;

export const getOrdersController = (): OrdersController => {
    if (controller) return controller;

    const clientId = process.env.PAYPAL_CLIENT_ID;
    const clientSecret = process.env.PAYPAL_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
        // Fail loud on first PayPal use rather than at server boot: a missing credential
        // here would otherwise surface as an opaque 401 from PayPal mid-checkout.
        throw new Error(
            'PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET must be set to use PayPal payments',
        );
    }

    const paypalClient = new Client({
        clientCredentialsAuthCredentials: {
            oAuthClientId: clientId,
            oAuthClientSecret: clientSecret,
        },
        environment:
            process.env.NODE_ENV === 'production'
                ? Environment.Production
                : Environment.Sandbox,
    });

    // One controller instance reused across requests (the client holds the auth state).
    controller = new OrdersController(paypalClient);
    return controller;
};

/**
 * The base URL of the PayPal REST API for the active environment. The webhook
 * signature-verification call (services/paypal/webhook.ts) is a raw REST call —
 * the SDK doesn't wrap that endpoint — so it needs the matching host.
 */
export const paypalApiBaseUrl =
    process.env.NODE_ENV === 'production'
        ? 'https://api-m.paypal.com'
        : 'https://api-m.sandbox.paypal.com';



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

