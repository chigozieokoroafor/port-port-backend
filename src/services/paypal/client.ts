import { Client, Environment, OrdersController } from '@paypal/paypal-server-sdk';

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
