import { OrderStatus } from '@paypal/paypal-server-sdk';
import { PaymentProvider } from '../../../../models/enums/PaymentProvider.enum';
import { PaymentStatus } from '../../../../models/enums/PaymentStatus.enum';
import Payment from '../../../../models/Payment.model';
// import { fromPayPalAmount } from '../../../../services/paypal';
import logger from '../../../../utils/logger';
import { fromPayPalAmount, paypalApiBaseUrl, getOrdersController, CapturedPayPalOrder } from '../../create-payment-v2/util';
import { capturedAmountMatchesExpectation, fulfillPaidPayment } from '../stripe/util';

/**
 * Finalize a completed PayPal capture (PAYMENT.CAPTURE.COMPLETED). Mirrors the Stripe
 * `handleSuccessfulPayment` shape: an atomic, one-way Unpaid→Paid flip keyed on the quote
 * reference (which PayPal echoes back on the capture as `custom_id`), then the shared
 * fulfillment tail. Only the first delivery to win the flip is `fresh`, gating the one-time
 * email; the shipment is created regardless so a retry still fulfills.
 *
 * The atomic flip matters more here than for Stripe: PayPal has TWO success signals — the
 * synchronous capture-on-return AND this webhook — so the conditional update is what stops
 * them double-shipping/double-emailing.
 *
 * Before flipping, the captured amount/currency is verified against the expectation locked
 * at order creation. A mismatch is NOT fulfilled — it's flagged for reconciliation.
 */
export const handlePayPalCaptureCompleted = async (resource: any): Promise<void> => {
    const quoteRef: string | undefined = resource?.custom_id;
    if (!quoteRef) {
        logger.error(`PayPal capture ${resource?.id} completed with no custom_id; cannot reconcile`);
        return;
    }

    const captureId: string | undefined = resource?.id;
    const capturedCurrency: string = (resource?.amount?.currency_code ?? 'USD').toUpperCase();
    const capturedAmount: number = fromPayPalAmount(resource?.amount?.value);

    // Load the record first to read the expectation we locked at order-creation time.
    const existing = await Payment.findOne({ quoteReference: quoteRef });
    if (!existing) {
        logger.error(`No payment record for quote ${quoteRef}; cannot fulfill PayPal payment`);
        return;
    }

    // Defense-in-depth: the settled money must match what we committed to. If it doesn't,
    // refuse to auto-fulfill — flag the record (leaving status un-advanced) and alert.
    if (!capturedAmountMatchesExpectation(existing, capturedAmount, capturedCurrency)) {
        logger.error(
            `PayPal capture amount mismatch for quote ${quoteRef}: expected ` +
            `${existing.expectedAmount} ${existing.expectedCurrency}, captured ` +
            `${capturedAmount} ${capturedCurrency} (capture ${captureId}). ` +
            `Not fulfilling — flagged for manual reconciliation.`
        );
        // Record what actually settled for the reviewer, but only while not already Paid
        // (never clobber a legitimately completed payment).
        await Payment.findOneAndUpdate(
            { quoteReference: quoteRef, status: { $ne: PaymentStatus.Paid } },
            {
                amountMismatch: true,
                amountPaid: capturedAmount,
                currency: capturedCurrency,
                paypalCaptureId: captureId,
            }
        );
        return;
    }

    const fresh = await Payment.findOneAndUpdate(
        { quoteReference: quoteRef, status: { $ne: PaymentStatus.Paid } },
        {
            status: PaymentStatus.Paid,
            provider: PaymentProvider.Paypal,
            paidAt: new Date(),
            amountPaid: capturedAmount,
            currency: capturedCurrency,
            paypalCaptureId: captureId,
        },
        { new: true }
    );

    // On a retry after the flip already happened (fresh === null) the record is already
    // Paid; reuse the copy we loaded so fulfillment stays idempotently correct.
    const payment = fresh ?? existing;
    await fulfillPaidPayment(payment, Boolean(fresh), quoteRef, capturedAmount, capturedCurrency);
};



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

export interface PayPalWebhookHeaders {
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
export const getPaypalAccessToken = async (): Promise<string> => {
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

    const token = await getPaypalAccessToken();

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

