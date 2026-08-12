import Stripe from 'stripe';

/**
 * Single Stripe client for the whole app.
 *
 * The API version is pinned explicitly (guide 1.1) so a Stripe-side default bump
 * can't silently change response shapes under us. Keep this string in step with
 * the installed `stripe` SDK — the SDK's own pinned version is what its types
 * validate against, so bumping the package will surface here as a type error,
 * which is the intended prompt to review the upgrade.
 */
export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, {
    apiVersion: '2026-02-25.clover',
});
