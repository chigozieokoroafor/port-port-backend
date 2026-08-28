# PayPal Payment Integration — Build & Test Guide (Phase 2: PayPal Redirect Flow)

This covers adding PayPal as the third payment method option, sitting alongside the already-completed Stripe integration (Phase 1). The three options on the payment screen map to two backend destinations:

- **Card** → Stripe Checkout Session
- **Bank Transfer** → Stripe Checkout Session (same session — Stripe surfaces it automatically as an available method on its hosted page)
- **PayPal** → PayPal's own standard order-and-redirect flow

PayPal is used only in its standard form here — the customer clicks "PayPal," is redirected to PayPal's own hosted page, pays however they have PayPal set up (balance, their own linked card, their own linked bank), and is redirected back. No card fields are embedded on your page for PayPal, no PCI consideration on your side, no special business approval process needed — this is the same "redirect to the provider's hosted page" pattern already used for Stripe, just pointing at a different provider.

**Advanced Credit and Debit Card Payments (ACDC) — deliberately not used.** PayPal offers a separate product for processing cards directly, with embedded card fields on your own page. This was considered and set aside: it duplicates what Stripe's Checkout Session already does for card payments, requires a distinct PayPal business approval process to go live, and adds UI complexity for no real benefit given Stripe already covers card and bank transfer cleanly. If PayPal-processed cards are ever needed later, this can be revisited as its own separate piece of work — it isn't part of this build.

---

## Fit This Into an Existing Codebase — Read Before Building

Same principle as Phase 1: inspect the existing codebase before adding anything new.

- The `Payment` model already has a `provider` field — reuse it, setting it to `paypal` for records created through this flow rather than introducing a second payment model.
- The existing central payment-creation endpoint already routes on provider selection (Stripe vs. PayPal) — extend that same routing point to call the new PayPal service module.
- Reuse the existing email service, `Shipment` creation logic, and quote-validation logic exactly as Phase 1 did — only the PayPal-specific order creation, capture, and webhook verification are new.

---

## 0. Prerequisites — What to Get Ready First

- A PayPal Developer account, with an App created under Apps & Credentials, giving you a **Client ID** and **Client Secret** — sandbox and live pairs kept separate, same discipline as the Stripe key pairs.
- A **Webhook ID**, generated the same way as Stripe's — registered under your app's webhook settings, used for signature verification, separate from your client secret.
- Confirmation of which currencies/countries your customers are actually in, since this affects what PayPal shows the buyer on their own hosted page — not something you configure, just worth knowing ahead of testing.
- No card-processing approval needed for this phase, since ACDC isn't in use — PayPal's standard checkout doesn't require the extra business approval step ACDC does.

---

## 1. Frontend — The PayPal Option

- A single "PayPal" button/radio option alongside the existing Stripe-backed "Card" and "Bank Transfer" options, all on the same payment method screen.
- Selecting it and confirming sends the quote ID and the provider selection (`paypal`) to the same central payment-creation endpoint already used for Stripe — no separate page needs to be designed or built; the entire payment-collection experience happens on PayPal's own hosted page after redirect.

---

## 2. Backend — PayPal Order Creation

Within the central payment-creation endpoint's PayPal branch:

1. Validate the request the same way the Stripe branch already does — quote exists, is approved, not already paid.
2. Create a PayPal order via the Orders API: intent set to capture immediately, the amount and currency from the quote, and your internal quote reference set in the order's custom identifier field so it comes back on capture and on the webhook.
3. Set the return and cancel URLs — built and supplied by your backend, same principle as Stripe's success/cancel URLs, just using PayPal's current field structure for specifying them.
4. Attach a unique request identifier for idempotency on the create call, so a network retry doesn't create a duplicate order.
5. Save a payment record — provider `paypal`, status unpaid, linked to the quote, storing the order ID — before returning anything to the frontend.
6. Return the approval URL to the frontend, which redirects the customer there.

---

## 3. Backend — Capture on Return

When the customer is redirected back to your return URL after approving on PayPal's page:

1. Read the order ID from the return URL.
2. Confirm the order's status is approved before attempting anything further.
3. Capture the order.
4. Treat this exactly like the Stripe success-page redirect — a UX convenience, not proof of payment. Don't finalize anything (shipment, confirmation email) purely from this step; wait for the webhook.

---

## 4. Webhook Handling

Same separate PayPal webhook endpoint described earlier (remote signature verification via API call, parsed JSON body). Handle:

- `PAYMENT.CAPTURE.COMPLETED` — mark the payment paid, update currency and PayPal capture ID on the record, create the shipment using the payment record's real database identifier, send the confirmation email — same pattern as the Stripe webhook's success path, isolated in its own handler function.
- `PAYMENT.CAPTURE.DENIED` — mark the payment failed.
- `CHECKOUT.ORDER.APPROVED` — worth including since a buyer can approve on PayPal's page and then abandon before your return-URL capture step runs; this event gives visibility into that gap rather than the payment silently sitting unresolved.

Idempotency: check whether the event ID has already been recorded as processed before doing any work, same principle as the Stripe webhook.

---

## 5. Testing Loop

- Use a PayPal sandbox buyer account to walk through the full redirect-approve-capture flow for a standard payment.
- Confirm the payment record, shipment, and confirmation email all end up correct after a successful test — not just that the webhook returned 200.
- Test a declined/failed scenario and confirm the payment record reflects it correctly, with no shipment created.
- Use the PayPal Webhooks Simulator to manually fire `CHECKOUT.ORDER.APPROVED` and confirm the abandonment scenario is captured correctly.
- Test the case where a customer returns to your return URL twice for the same order (e.g. back button + reload) and confirm the second capture attempt is handled gracefully rather than erroring the request.
- Confirm a payment created via PayPal shows up correctly in the same payment history view already built for Stripe, with `provider: paypal` distinguishing it.

---

## Rollout Checklist

- [ ] PayPal sandbox app created, client ID/secret and webhook ID in place
- [ ] Frontend PayPal option added to the existing payment method screen — no new page built
- [ ] Central endpoint's PayPal branch: validation, order creation with custom ID, return/cancel URLs, idempotency key, payment record saved before responding
- [ ] Return-URL handler: capture, treated as UX only, not a source of truth
- [ ] Webhook handler: `PAYMENT.CAPTURE.COMPLETED`, `PAYMENT.CAPTURE.DENIED`, `CHECKOUT.ORDER.APPROVED`, idempotency check
- [ ] Sandbox testing: full happy path, declined path, simulated abandonment, double-capture-attempt handling
- [ ] Payment history correctly shows PayPal-provider records alongside Stripe ones