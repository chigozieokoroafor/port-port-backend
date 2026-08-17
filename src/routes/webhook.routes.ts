import  express, { Request, Response, NextFunction, Router } from "express";
import { StripeWebhookController } from "../controllers/payment/webhook/stripe";
import { PaypalWebhookController } from "../controllers/payment/webhook/paypal";
// import { webhook, paypalWebhook } from "../controllers/payment.controller";

const router = Router();

// Both webhook routes carry their provider prefix here and are mounted at the app root,
// giving clean, provider-scoped paths (/stripe/webhook, /paypal/webhook) that never clash.

// Stripe: signature is an HMAC over the EXACT raw bytes, so this route must see the
// unparsed body — express.raw() before the global JSON parser.
router.post('/stripe/webhook',
    express.raw({ type: 'application/json' }),
    StripeWebhookController);

// PayPal: verification is REMOTE and needs the PARSED event body, so this route parses
// JSON itself (it's mounted before the app's global JSON parser).
router.post('/paypal/webhook',
    express.json(),
    PaypalWebhookController);

export default router;