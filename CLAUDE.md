# Stripe Payment Integration — Build & Test Guide (Phase 1: Stripe Only)

This covers everything needed to build and test the Stripe side of the payment flow end to end, before PayPal is introduced. PayPal, mobile money, and any card-fields-on-your-own-page approach are explicitly out of scope for this phase.

**On tooling:** this integration uses the official Stripe SDK (the `stripe` package for your backend language), authenticated with your Stripe secret key. You don't hand-build raw HTTP requests to Stripe's API — the SDK wraps that for you. The API key is the credential; the SDK is the tool that uses it.

---

## Fit This Into an Existing Codebase — Read Before Building

This guide describes the required steps and their correct order; it does not assume a specific framework, folder structure, or that any of this is being built from a blank project. Before writing any code, inspect the existing codebase and match it rather than inventing parallel structures:

- **Identify the existing framework and conventions** — routing style, folder layout (controllers/services/routes separation, or whatever pattern is already in use), naming conventions for files and functions — and follow the same pattern for anything new.
- **Locate and reuse existing models** — a `Quote` model, a `Payment` model, a `Shipment` model, and a `QuoteRequest` or customer model likely already exist. Read their current field names and types before adding anything. Extend the existing `Payment` model with the new fields this guide calls for (currency, Stripe session ID, Stripe payment-intent ID) rather than creating a second, competing payment model.
- **Locate and reuse existing middleware** — authentication middleware, error-handling middleware, and any existing request-validation pattern should be reused for the new endpoint, not reimplemented.
- **Locate and reuse the existing email service** — if a mailer or email-sending utility already exists in the codebase, use it to send the confirmation email described in step 5, matching however other emails in the app are already being sent, rather than introducing a separate email mechanism.
- **Match existing route-naming conventions** — the route names in this guide (e.g. `/api/payments/create`) are illustrative, not mandatory. If the codebase already has a `/api/payment` prefix or a different pluralization/naming style in use, follow that instead.
- **Do not duplicate logic that already exists** — if quote validation, currency handling, or similar logic already exists elsewhere in the codebase, extend or call it rather than writing a second version.
- **If something described here doesn't have an obvious existing equivalent** (for example, no webhook-event logging table exists yet), it's fine to create it new — just check first rather than assuming.

The goal is for everything built from this guide to look like it was written by the same team that wrote the rest of the codebase, not like a separate module bolted on beside it.

---

## 0. Prerequisites — What to Get Ready First

- A Stripe account (test mode is usable immediately, no business verification needed yet).
- **Secret key** and **publishable key**, from Dashboard → Developers → API keys. Test-mode and live-mode versions are separate — keep them clearly separated in your environment configuration.
- **Webhook signing secret** — for local development, this comes from the Stripe CLI when you run its forwarding command; for production, it's generated when you register your live webhook endpoint URL in the Dashboard.
- Decide and note the **API version** you're building against, to be pinned when the SDK is initialized.
- Confirm in Dashboard → Settings → Payment methods which currencies and payment methods are actually enabled on your account, since "all currencies" in practice means "all currencies enabled for your account," not the full global list automatically.
- A publicly reachable HTTPS URL for webhooks once you're testing against something other than localhost — the Stripe CLI substitutes for this during local development.

---

## 1. Order Preview Page (Frontend)

This is the "Make Payments" screen — quote summary, cost breakdown, payment method selection (Card, Bank Transfer — both routed through Stripe's own hosted page; PayPal deferred to Phase 2). The customer reviews everything here before committing to anything. Once they click "Pay Now," the frontend sends a request to your backend rather than collecting any card details directly on this page.

**What the frontend sends to the backend:** a JSON payload containing at minimum the quote ID and the selected payment method identifier (e.g. `"card"` or `"bank_transfer"`). This selection is what lets the backend later decide which payment methods to enable on the Stripe session — though since both currently route through the same Stripe flow, this mostly matters for enabling the right options on the session itself.

---

## 2. Backend — Central Payment-Creation Endpoint

One single endpoint (e.g. `POST /api/payments/create`) receives the JSON payload from step 1. This is the one legitimate place a routing decision happens — reading the payload and deciding what to do next. Its responsibilities, in order:

1. **Validate the request.** Confirm the quote exists, is in an approved/payable state, and hasn't already been paid. Reject anything malformed or incomplete before any Stripe-facing code runs.
2. **Resolve the amount and currency.** Pull the amount and currency from the quote. Convert the amount into Stripe's expected minor-unit format — multiply by 100 for standard two-decimal currencies, but check the currency against Stripe's zero-decimal list first (JPY, KRW, VND, and similar) and skip the multiplication for those. Round the result to guard against floating-point drift. Lowercase the currency code, since Stripe requires this in every request.
3. **Attach your internal reference.** Use `client_reference_id` for the quote's reference number, and `metadata` for any additional structured detail (quote number and database ID together) you want available on the session and later on the webhook event.
4. **Attach an idempotency key.** Generate a unique value per creation attempt so a network retry doesn't create a duplicate session.
5. **Set the success and cancel URLs.** These are built and supplied by your backend — they're just strings pointing to pages on your own domain; Stripe has no say in what they look like. The success URL should include the literal placeholder text for the session ID (Stripe substitutes the real value into it before redirecting), so your success page can read it off the URL. The cancel URL doesn't need a placeholder.
6. **Call the Stripe SDK to create the Checkout Session**, passing everything gathered above, along with line items built via `price_data` (since the amount is computed dynamically per quote rather than drawn from a saved catalog price).
7. **Save a payment record in your own database** — status "unpaid," linked to the quote, storing the new session ID — before returning anything to the frontend, so nothing about this attempt is lost if a later step fails.
8. **Return the session URL to the frontend.**

---

## 3. Redirect to Stripe (Frontend)

The frontend takes the session URL returned in step 2 and redirects the customer to it. The customer enters payment details entirely on Stripe's own hosted page — nothing about card or bank transfer entry is built by you.

---

## 4. Success and Cancel Pages (Frontend)

Two simple pages/routes, built by you, matching the URLs supplied in step 2:

- **Success page** — reads the session ID off the URL and shows a friendly "processing your payment" or order-confirmation message. This is a UX nicety, not proof of payment — never treat this page load as confirmation that the payment succeeded.
- **Cancel page** — shown if the customer backs out, with a way to retry.

Keep these URLs environment-specific (local dev vs. production) via configuration, so a test build never points at a live success page or vice versa.

---

## 5. Webhook Endpoint (Backend)

A separate route entirely from the payment-creation endpoint — its own URL, its own concerns. Responsibilities, in order:

1. **Receive the raw, unparsed request body.** Any global JSON-parsing middleware must not touch this route, since Stripe's signature check depends on the exact original bytes.
2. **Verify the signature** using the raw body, the signature header, and the webhook secret. A failed verification returns a client-error status — nothing to retry, it's not a genuine request.
3. **Check idempotency** — has this specific event ID already been recorded as processed? If so, acknowledge with success immediately without redoing any work.
4. **Route on event type.** At minimum: `checkout.session.completed` for success, `payment_intent.payment_failed` for declines. Consider also `checkout.session.expired` so abandoned sessions are reflected in your records.
5. **On success:** update the payment record to "paid," capture the currency and Stripe's own session/payment-intent identifiers onto the record, create the shipment using the payment record's real database identifier (not any string reference), and send the confirmation email — with the email call isolated so its failure can't undo the payment/shipment recording.
6. **Respond correctly.** Genuine processing failures return a server-error status so Stripe retries. Events intentionally left unhandled, or already-processed duplicates, return success.

---

## 6. Payment History / Status View (Backend + Frontend)

- The payment record populated through steps 2 and 5 (status, amount, currency, paid date, Stripe identifiers) backs a history table directly.
- Add a public route that looks up payment status by the quote reference number, placed ahead of any authentication middleware, returning only non-sensitive fields — so a customer without an account can still check on a payment.
- Status shown to the customer should include a genuine failed/declined state, not just completed and pending.

---

## 7. Local Testing Loop

- Install and log into the Stripe CLI; use its forwarding command to route Stripe's webhook events to your local server, which also prints a temporary signing secret to use locally.
- Use Stripe's documented test card numbers to walk through a successful payment, a payment requiring additional authentication, and a declined payment.
- Manually trigger `checkout.session.completed` and `payment_intent.payment_failed` via the CLI to confirm both webhook paths update your database correctly, independent of a live browser test.
- Test at least one standard two-decimal currency and one zero-decimal currency (e.g. JPY) through the full flow, since currency-conversion mistakes are the most common and most silent bug in this kind of integration.
- Confirm the payment record, the shipment record, and the confirmation email all end up correct after a successful test run — not just that the webhook returned 200.

---

## Explicitly Out of Scope for This Phase

- PayPal integration (Phase 2, after Stripe is fully tested)
- Mobile money / USSD (not offered by Stripe or PayPal; would need a third provider, not currently planned)
- Card fields built directly on your own page (PCI scope concern — ruled out; card entry happens on Stripe's hosted page)

---

## Rollout Checklist

- [ ] Stripe account and test-mode keys ready
- [ ] Order preview page sends method selection + quote ID to backend
- [ ] Central create-session endpoint: validation, currency/amount handling, metadata, idempotency key, success/cancel URLs, session creation, payment record saved before responding
- [ ] Frontend redirects to session URL
- [ ] Success and cancel pages built
- [ ] Webhook endpoint: raw body, signature verification, idempotency check, event routing, correct status codes
- [ ] Shipment creation and confirmation email wired into the success path
- [ ] Payment history table and public status-lookup route
- [ ] Local testing via Stripe CLI: test cards, manually triggered events, at least one zero-decimal currency