import Stripe from 'stripe';
import { randomUUID } from 'node:crypto';
import { IQuote } from '../../models/Quote.model';
import { ApiError } from '../../utils/ApiError';
import { stripe } from './stripe';
import { toMinorUnits } from './currency';
import { PaymentMethod } from '../../models/enums/PaymentMethod.enum';

// Currencies this Stripe account supports. Extend as the account is enabled for more.
// JPY is included as the zero-decimal representative (see toMinorUnits): it has no
// bank rail in BANK_METHOD_BY_CURRENCY, so it is card-only and bank_transfer is
// rejected for it below — which is the intended behaviour.
const SUPPORTED_CURRENCIES = ['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'NGN', 'JPY'];

// Bank-debit `payment_method_type` to enable for a "bank transfer" selection,
// keyed by currency. Stripe's bank rails are currency/region-specific, so the
// correct type depends on the quote's currency. Currencies with no supported
// bank rail (e.g. NGN) are intentionally absent and rejected below rather than
// silently falling back to card.
const BANK_METHOD_BY_CURRENCY: Partial<Record<string, Stripe.Checkout.SessionCreateParams.PaymentMethodType>> = {
    USD: 'us_bank_account',
    EUR: 'sepa_debit',
    GBP: 'bacs_debit',
    CAD: 'acss_debit',
    AUD: 'au_becs_debit',
};

/**
 * Translate the customer's selected method (guide §1–2) into the concrete
 * `payment_method_types` enabled on the Checkout Session. Setting this
 * explicitly — rather than leaving Stripe's automatic methods on — is what
 * makes the selection actually take effect on the session.
 */
const resolvePaymentMethodTypes = (
    method: PaymentMethod,
    currency: string,
): Stripe.Checkout.SessionCreateParams.PaymentMethodType[] => {
    if (method === PaymentMethod.Card) return ['card'];

    const bankMethod = BANK_METHOD_BY_CURRENCY[currency.toUpperCase()];
    if (!bankMethod) {
        throw new ApiError(400, `Bank transfer is not available for ${currency}; please pay by card`);
    }
    return [bankMethod];
};

// Stripe requires a Checkout Session's expires_at to be between 30 minutes and
// 24 hours from creation. We tie expiry to the quote's own validity window but
// clamp it into that allowed range.
const MIN_EXPIRY_SECONDS = 30 * 60;
const MAX_EXPIRY_SECONDS = 24 * 60 * 60;

/**
 * Compute the session's expires_at (unix seconds), clamped to Stripe's allowed
 * window. A quote whose validity has already passed can't be paid, so we reject
 * it up front rather than creating a session that contradicts the quote.
 */
const computeExpiry = (quote: IQuote): number => {
    const nowSeconds = Math.floor(Date.now() / 1000);
    const validUntilSeconds = Math.floor(new Date(quote.terms.validUntil).getTime() / 1000);

    if (validUntilSeconds <= nowSeconds) {
        throw new ApiError(400, 'Quote validity period has expired; generate a new quote');
    }

    const requested = validUntilSeconds - nowSeconds;
    const clamped = Math.min(Math.max(requested, MIN_EXPIRY_SECONDS), MAX_EXPIRY_SECONDS);
    return nowSeconds + clamped;
};

/**
 * Create a single-use Stripe Checkout Session for a quote (guide 1.2–1.4).
 *
 * - `price_data` is used rather than a catalog `price`, since pricing is computed
 *   per quote rather than drawn from a fixed catalog (guide 1.3).
 * - The customer's selected method (`card` / `bank_transfer`) is translated into
 *   explicit `payment_method_types`, so the choice made on the preview page is
 *   what the hosted page actually offers (guide §1–2).
 * - The quote reference travels on both `client_reference_id` (Stripe's dedicated
 *   reconciliation field) and `metadata`, and the same metadata is mirrored onto
 *   the PaymentIntent so a `payment_intent.payment_failed` event carries it too.
 * - A per-call idempotency key protects the create call against transient network
 *   retries (guide 1.4). It is intentionally unique per invocation so that a
 *   deliberate re-generation (e.g. after a session expires) produces a fresh
 *   session rather than replaying a stale one.
 */
export const createCheckoutSession = async (
    quote: IQuote,
    paymentMethod: PaymentMethod,
): Promise<Stripe.Checkout.Session> => {
    const currency = quote.pricing.currency?.toUpperCase();

    if (!currency || !SUPPORTED_CURRENCIES.includes(currency)) {
        throw new ApiError(400, `Unsupported currency: ${quote.pricing.currency}`);
    }

    const paymentMethodTypes = resolvePaymentMethodTypes(paymentMethod, currency);
    const unitAmount = toMinorUnits(quote.pricing.totalAmount, currency);
    const expiresAt = computeExpiry(quote);

    const metadata = {
        quoteRef: quote.quoteNumber,
        quoteId: ((quote as any).id || (quote as any)._id).toString(),
    };

    const frontendUrl = process.env.FRONTEND_URL as string;

    const session = await stripe.checkout.sessions.create(
        {
            mode: 'payment',
            payment_method_types: paymentMethodTypes,
            line_items: [
                {
                    price_data: {
                        currency: currency.toLowerCase(),
                        product_data: { name: quote.quoteNumber },
                        unit_amount: unitAmount,
                    },
                    quantity: 1,
                },
            ],
            client_reference_id: quote.quoteNumber,
            metadata,
            payment_intent_data: { metadata },
            expires_at: expiresAt,
            // The redirect is a UX convenience only — the webhook is the source of
            // truth (guide 1.8). {CHECKOUT_SESSION_ID} is substituted by Stripe.
            success_url: `${frontendUrl}/payment/success?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${frontendUrl}/payment/cancel?quoteRef=${quote.quoteNumber}`,
        },
        { idempotencyKey: randomUUID() }
    );

    return session;
};
