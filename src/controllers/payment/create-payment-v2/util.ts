import { object, string } from "yup";
import { prisma } from "../../../config/database";
import { ApiError } from "../../../utils/ApiError";
import { createCheckoutSession } from '../../../services/payment';
import { stripe } from '../../../services/payment/stripe';
import logger from '../../../utils/logger';
import { PaymentMethod } from '../../../models/enums/PaymentMethod.enum';
import { Client, Environment, OrdersController, CheckoutPaymentIntent, Order, PaypalExperienceUserAction, OrderStatus } from '@paypal/paypal-server-sdk';
import { randomUUID } from 'node:crypto';

export const CreatePaymentDTO = object(
    {
        quoteId: string().required("Missing value of quote id"),
        userId: string().optional(),
        paymentMethod: string().oneOf(["paypal", "stripe"]).required("Missing value of payment method.")
    }
)

export type TCreatePaymentDTO = typeof CreatePaymentDTO.__outputType;

export async function getQuoteByProvidedId(dto: TCreatePaymentDTO) {
    const quote = await prisma.quote.findUnique({
        where: {
            id: dto.quoteId
        }
    })

    if (!quote) {
        throw new ApiError(404, "Quote not found")
    }

    if (quote.status !== "Pending") {
        throw new ApiError(400, "Quote already paid for, not allowed to create new payment.")
    }

    return quote;
}

export async function handlePaypalPayment(quote: Awaited<ReturnType<typeof getQuoteByProvidedId>>, userId?: string) {
    const frontendUrl = process.env.FRONTEND_URL as string;
    const returnUrl = `${process.env.BACKEND_URL}/api/payment/paypal/return?quoteRef=${quote.quoteNumber}`;
    const cancelUrl = `${frontendUrl}/payment/cancel?quoteRef=${quote.quoteNumber}`;

    // Note: The original Quote interface from mongoose had `quote.pricing`, which in Prisma is a Json/Composite type. 
    // I need to cast it or assume it has totalAmount and currency
    const pricing: any = quote.pricing;

    const { orderId, approvalUrl } = await createPayPalOrder(
        quote as any, // Cast to any to bypass mongoose IQuote type used in createPayPalOrder
        returnUrl,
        cancelUrl
    );

    const payment = await prisma.payment.upsert({
        where: { quoteReference: quote.quoteNumber },
        update: {
            provider: "Paypal",
            paymentUrl: approvalUrl,
            paypalOrderId: orderId,
            expectedAmount: pricing?.totalAmount,
            expectedCurrency: pricing?.currency?.toUpperCase(),
            updatedById: userId,
        },
        create: {
            quoteId: quote.id,
            createdById: userId,
            quoteReference: quote.quoteNumber,
            status: "Unpaid",
            provider: "Paypal",
            paymentUrl: approvalUrl,
            paypalOrderId: orderId,
            expectedAmount: pricing?.totalAmount,
            expectedCurrency: pricing?.currency?.toUpperCase(),
        }
    });

    return {
        success: true,
        message: 'PayPal order created',
        data: {
            provider: "Paypal",
            checkoutUrl: approvalUrl,
            orderId,
            paymentId: payment.id
        }
    };
}



export async function handleStripePayment(quote: Awaited<ReturnType<typeof getQuoteByProvidedId>>, userId?: string) {
    // Note: quote must be cast to any since createCheckoutSession was typed for mongoose IQuote
    const session = await createCheckoutSession(quote as any, PaymentMethod.Stripe);
    const pricing: any = quote.pricing;

    // Fetch existing payment to check if we need to expire an old session
    const existing = await prisma.payment.findUnique({
        where: { quoteReference: quote.quoteNumber }
    });

    const payment = await prisma.payment.upsert({
        where: { quoteReference: quote.quoteNumber },
        update: {
            provider: "Stripe",
            paymentUrl: session.url,
            stripeSessionId: session.id,
            expectedAmount: pricing?.totalAmount,
            expectedCurrency: pricing?.currency?.toUpperCase(),
            updatedById: userId,
        },
        create: {
            quoteId: quote.id,
            createdById: userId,
            quoteReference: quote.quoteNumber,
            status: "Unpaid",
            provider: "Stripe",
            paymentUrl: session.url,
            stripeSessionId: session.id,
            expectedAmount: pricing?.totalAmount,
            expectedCurrency: pricing?.currency?.toUpperCase(),
        }
    });

    // Check if an existing Stripe session was superseded and expire it on Stripe's side
    if (existing?.stripeSessionId && existing.stripeSessionId !== session.id) {
        try {
            await stripe.checkout.sessions.expire(existing.stripeSessionId);
            logger.info(`Expired previous session ${existing.stripeSessionId} for quote ${quote.quoteNumber}`);
        } catch (err: any) {
            logger.warn(`Could not expire previous session ${existing.stripeSessionId}: ${err.message}`);
        }
    }

    return {
        success: true,
        message: 'Checkout session created',
        data: {
            provider: "Stripe",
            checkoutUrl: session.url,
            sessionId: session.id,
            expiresAt: session.expires_at,
            paymentId: payment.id
        }
    };
}

export async function handlePayments(quote: Awaited<ReturnType<typeof getQuoteByProvidedId>>, dto: TCreatePaymentDTO) {
    const { paymentMethod } = dto;
    if (paymentMethod === "paypal") {
        return handlePaypalPayment(quote, dto.userId);
    }
    else if (paymentMethod === "stripe") {
        return handleStripePayment(quote, dto.userId);
    }
}


let controller: OrdersController | undefined;

export const getOrdersController = (): OrdersController => {
    if (controller) return controller;

    const clientId = process.env.PAYPAL_CLIENT_ID;
    const clientSecret = process.env.PAYPAL_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
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

    controller = new OrdersController(paypalClient);
    return controller;
};

export const paypalApiBaseUrl =
    process.env.NODE_ENV === 'production'
        ? 'https://api-m.paypal.com'
        : 'https://api-m.sandbox.paypal.com';

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

export const createPayPalOrder = async (
    quote: any,
    returnUrl: string,
    cancelUrl: string,
): Promise<CreatedPayPalOrder> => {
    const currency = quote.pricing.currency?.toUpperCase();
    if (!currency) {
        throw new ApiError(400, `Unsupported currency: ${quote.pricing.currency}`);
    }

    const value = toPayPalAmount(quote.pricing.totalAmount, currency);

    const { result, statusCode } = await getOrdersController().createOrder({
        body: {
            intent: CheckoutPaymentIntent.Capture,
            purchaseUnits: [
                {
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

const ZERO_DECIMAL_CURRENCIES = new Set([
    'BIF', 'CLP', 'DJF', 'GNF', 'JPY', 'KMF', 'KRW', 'MGA', 'PYG',
    'RWF', 'UGX', 'VND', 'VUV', 'XAF', 'XOF', 'XPF',
]);

const PAYPAL_SUPPORTED_CURRENCIES = new Set([
    'USD', 'EUR', 'GBP', 'CAD', 'AUD', 'JPY',
]);

export const toPayPalAmount = (amount: number, currency: string): string => {
    const code = currency.toUpperCase();

    if (!PAYPAL_SUPPORTED_CURRENCIES.has(code)) {
        throw new ApiError(400, `PayPal does not support ${currency}; please pay by card`);
    }

    const decimals = ZERO_DECIMAL_CURRENCIES.has(code) ? 0 : 2;
    return amount.toFixed(decimals);
};

export const fromPayPalAmount = (value: string | undefined): number => {
    const n = Number.parseFloat(value ?? '');
    return Number.isFinite(n) ? n : 0;
};

export interface CapturedPayPalOrder {
    status: OrderStatus | undefined;
    captureId?: string;
    quoteReference?: string;
    currency?: string;
    amount?: string;
    alreadyCaptured: boolean;
}
