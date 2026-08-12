import { paypalApiBaseUrl } from './client';

/**
 * PayPal webhook signature verification.
 *
 * Unlike Stripe — which verifies a webhook LOCALLY with an HMAC over the raw body and
 * the signing secret — PayPal verifies REMOTELY: you POST the received headers plus
 * the parsed event body and your configured webhook id back to PayPal, and it tells
 * you whether the signature is valid. That's why the PayPal webhook route parses JSON
 * (it needs the structured `webhook_event`) rather than taking the raw body the way
 * the Stripe route does.
 *
 * The SDK (v2.4) wraps Orders/Payments/Vault/etc. but NOT this verification endpoint,
 * so this is a plain authenticated REST call: fetch an OAuth token from the client
 * credentials, then call verify-webhook-signature.
 */

interface PayPalWebhookHeaders {
    transmissionId?: string;
    transmissionTime?: string;
    transmissionSig?: string;
    certUrl?: string;
    authAlgo?: string;
}

/**
 * Pull the five verification headers PayPal sends alongside every webhook. Header
 * names are lower-cased by Node's http layer; we read them defensively.
 */
export const extractPayPalHeaders = (
    headers: Record<string, string | string[] | undefined>,
): PayPalWebhookHeaders => {
    const get = (name: string): string | undefined => {
        const v = headers[name];
        return Array.isArray(v) ? v[0] : v;
    };
    return {
        transmissionId: get('paypal-transmission-id'),
        transmissionTime: get('paypal-transmission-time'),
        transmissionSig: get('paypal-transmission-sig'),
        certUrl: get('paypal-cert-url'),
        authAlgo: get('paypal-auth-algo'),
    };
};

/** Fetch an OAuth access token from the client credentials for a raw REST call. */
const getAccessToken = async (): Promise<string> => {
    const id = process.env.PAYPAL_CLIENT_ID as string;
    const secret = process.env.PAYPAL_CLIENT_SECRET as string;
    const basic = Buffer.from(`${id}:${secret}`).toString('base64');

    const res = await fetch(`${paypalApiBaseUrl}/v1/oauth2/token`, {
        method: 'POST',
        headers: {
            Authorization: `Basic ${basic}`,
            'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: 'grant_type=client_credentials',
    });

    if (!res.ok) {
        throw new Error(`PayPal OAuth token request failed: ${res.status}`);
    }
    const data = (await res.json()) as { access_token?: string };
    if (!data.access_token) throw new Error('PayPal OAuth token missing from response');
    return data.access_token;
};

/**
 * Verify a PayPal webhook by asking PayPal. Returns true only if PayPal reports
 * verification_status SUCCESS for the given headers + event body + our webhook id.
 *
 * Any missing header, missing webhook id, or non-SUCCESS status returns false — the
 * caller treats false as an unauthenticated request (400) and does no work, mirroring
 * how the Stripe webhook rejects a bad signature.
 *
 * `event` is the PARSED webhook body (PayPal hashes a canonical form server-side, so
 * unlike Stripe we do not need the exact raw bytes here).
 */
export const verifyPayPalWebhook = async (
    headers: PayPalWebhookHeaders,
    event: unknown,
): Promise<boolean> => {
    const webhookId = process.env.PAYPAL_WEBHOOK_ID;
    if (
        !webhookId ||
        !headers.transmissionId ||
        !headers.transmissionTime ||
        !headers.transmissionSig ||
        !headers.certUrl ||
        !headers.authAlgo
    ) {
        return false;
    }

    const token = await getAccessToken();

    const res = await fetch(`${paypalApiBaseUrl}/v1/notifications/verify-webhook-signature`, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            transmission_id: headers.transmissionId,
            transmission_time: headers.transmissionTime,
            transmission_sig: headers.transmissionSig,
            cert_url: headers.certUrl,
            auth_algo: headers.authAlgo,
            webhook_id: webhookId,
            webhook_event: event,
        }),
    });

    if (!res.ok) return false;
    const data = (await res.json()) as { verification_status?: string };
    return data.verification_status === 'SUCCESS';
};
