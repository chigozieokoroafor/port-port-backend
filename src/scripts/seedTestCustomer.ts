import dotenv from 'dotenv';
dotenv.config();

import { connectDB } from '../config/database';
import logger from '../utils/logger';
import User from '../models/User.model';
import QuoteRequest from '../models/QuoteRequest.model';
import Quote from '../models/Quote.model';
import { UserStatus } from '../models/enums/UserStatus.enum';
import { UserType } from '../models/enums/UserType.enum';
import { Status } from '../models/enums/Status.enum';
import { VehicleType } from '../models/enums/VehicleType.enum';
import { VehicleCondition } from '../models/enums/VehicleCondition.enum';

/**
 * Seed a ready-to-use test customer plus APPROVED quotes owned by them, so both the
 * Stripe and PayPal payment paths can be exercised without going through the real
 * register → verify-email → submit-request → admin-generate → admin-approve chain.
 *
 * Why a script and not the public API: `POST /api/auth/create` makes customers
 * `Pending`, and login rejects `Pending` until an email link is clicked (needs
 * live SMTP). This inserts the customer already `Active`, so `POST /api/auth/login`
 * returns a token straight away.
 *
 * It is idempotent — re-running reuses the same fixed references and always resets
 * the customer's password to the documented value, so the printed credentials work
 * every time. This is a TEST fixture; do not run it against a production database.
 *
 * Run:  npm run seed:customer
 */

// Stable references so re-runs update the same documents instead of piling up.
const TEST_CUSTOMER_EMAIL = process.env.TEST_CUSTOMER_EMAIL || 'customer@test.com';
const TEST_CUSTOMER_PASSWORD = process.env.TEST_CUSTOMER_PASSWORD || 'Test1234!';
const TEST_QUOTE_REQUEST_REF = 'QR-SEEDTEST';
const TEST_QUOTE_NUMBER = 'QT-SEEDTEST';           // standard two-decimal currency (USD)
const TEST_QUOTE_NUMBER_JPY = 'QT-SEEDTEST-JPY';   // zero-decimal currency (JPY) for Test 2
const TEST_QUOTE_NUMBER_3DS = 'QT-SEEDTEST-3DS';   // 3D-Secure success (USD) for Test 4
const TEST_QUOTE_NUMBER_BANK = 'QT-SEEDTEST-BANK'; // bank transfer / us_bank_account (USD)
const TEST_QUOTE_NUMBER_EUR = 'QT-SEEDTEST-EUR';   // bank transfer / SEPA (EUR)
const TEST_QUOTE_NUMBER_FAIL = 'QT-SEEDTEST-FAIL'; // reusable decline / regeneration (USD), never reaches Paid

// PayPal (Phase 2) fixtures — paid via `paymentMethod: paypal`, which routes to PayPal's
// own order-and-redirect flow instead of Stripe Checkout. PayPal supports a different
// currency set than Stripe (USD/EUR/GBP/CAD/AUD/JPY), so these exercise both a happy
// path and the currency guard.
const TEST_QUOTE_NUMBER_PP_USD = 'QT-SEEDTEST-PP-USD';     // PayPal happy path (USD, two-decimal)
const TEST_QUOTE_NUMBER_PP_JPY = 'QT-SEEDTEST-PP-JPY';     // PayPal zero-decimal (JPY) — "150000" not "150000.00"
const TEST_QUOTE_NUMBER_PP_CANCEL = 'QT-SEEDTEST-PP-CANCEL'; // reusable cancel/abandon (USD), never reaches Paid
const TEST_QUOTE_NUMBER_PP_NGN = 'QT-SEEDTEST-PP-NGN';     // reusable currency-guard reject (NGN — Stripe-only)

const seedTestCustomer = async () => {
    try {
        await connectDB();

        // 1) Customer — created Active so it can log in without email verification.
        //    On re-run, force the password + status back to the documented values.
        let customer = await User.findOne({ email: TEST_CUSTOMER_EMAIL });
        if (customer) {
            customer.password = TEST_CUSTOMER_PASSWORD; // pre-save hook re-hashes
            customer.status = UserStatus.Active;
            customer.role = UserType.Customer;
            await customer.save();
            logger.info('Test customer already existed — password/status reset');
        } else {
            customer = await User.create({
                email: TEST_CUSTOMER_EMAIL,
                password: TEST_CUSTOMER_PASSWORD,
                tempPassword: TEST_CUSTOMER_PASSWORD,
                firstName: 'Test',
                lastName: 'Customer',
                role: UserType.Customer,
                status: UserStatus.Active,
                isSubscribedToNewsletter: false,
                isAgreedToTermsAndConditions: true,
            });
            logger.info('Test customer created');
        }

        // A Quote requires `generatedBy` (a User). Prefer the seeded SuperAdmin so it
        // looks like a real admin-generated quote; fall back to the customer's own id
        // if no admin has been seeded yet (keeps this script self-sufficient).
        const admin = await User.findOne({ role: UserType.SuperAdmin })
            || await User.findOne({ role: UserType.Admin });
        const generatedBy = admin?._id ?? customer._id;

        // 2) QuoteRequest — `user` is the ownership link enforced in payment.create;
        //    `customer.email`/`customer.fullName` feed the confirmation email.
        let quoteRequest = await QuoteRequest.findOne({ referenceId: TEST_QUOTE_REQUEST_REF });
        if (!quoteRequest) {
            quoteRequest = await QuoteRequest.create({
                referenceId: TEST_QUOTE_REQUEST_REF,
                user: customer._id,
                customer: {
                    fullName: 'Test Customer',
                    email: TEST_CUSTOMER_EMAIL,
                    phone: '+10000000000',
                },
                vehicle: {
                    type: VehicleType.CarsAndSuvs,
                    make: 'Toyota',
                    model: 'Corolla',
                    year: 2020,
                    vin: 'TESTVIN0000000001',
                    dimensions: { length: 4.6, width: 1.8, height: 1.4 },
                    weight: 1300,
                    condition: VehicleCondition.Running,
                },
                route: {
                    originCountry: 'United States',
                    originPort: 'Baltimore',
                    destinationCountry: 'Nigeria',
                    destinationPort: 'Lagos',
                },
                status: Status.Approved,
            });
            logger.info('Test quote request created');
        } else {
            // Keep the ownership link pointed at the current customer on re-run.
            quoteRequest.user = customer._id as typeof quoteRequest.user;
            await quoteRequest.save();
            logger.info('Test quote request already existed — owner re-linked');
        }

        // 3) Quote(s) — must be Approved (payment.create rejects non-approved) and
        //    valid into the future (computeExpiry rejects an already-expired quote).
        //    We seed a spread of currencies/methods across both providers so every
        //    payment path (Stripe card/bank, PayPal order) is ready to pay.
        const validUntil = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

        // Upsert a quote by its stable number, refreshing validity/approval on re-run.
        const upsertQuote = async (
            quoteNumber: string,
            currency: string,
            totalAmount: number,
        ) => {
            let quote = await Quote.findOne({ quoteNumber });
            if (!quote) {
                quote = await Quote.create({
                    quoteNumber,
                    quoteRequestId: quoteRequest._id,
                    pricing: {
                        shippingCost: totalAmount,
                        totalAmount,
                        currency,
                    },
                    terms: {
                        validUntil,
                        paymentTerms: 'Payment due on receipt',
                    },
                    status: Status.Approved,
                    generatedBy,
                    createdBy: generatedBy,
                });
                logger.info(`Test quote ${quoteNumber} created (Approved, ${currency})`);
            } else {
                // Refresh validity + approval so an old run's expired quote still works.
                quote.terms.validUntil = validUntil;
                quote.status = Status.Approved;
                quote.quoteRequestId = quoteRequest._id as typeof quote.quoteRequestId;
                await quote.save();
                logger.info(`Test quote ${quoteNumber} already existed — refreshed (${currency})`);
            }
            return quote;
        };

        // Each success-ending test needs its OWN quote, because create() blocks a quote
        // once its payment is Paid ("Payment is already paid for") and re-seeding does
        // NOT clear the Payment collection. Failing/expiring tests can share one quote,
        // since Failed/Unpaid/Expired never trips that block.
        const usdQuote = await upsertQuote(TEST_QUOTE_NUMBER, 'USD', 1500);       // Test 1  card happy path
        const jpyQuote = await upsertQuote(TEST_QUOTE_NUMBER_JPY, 'JPY', 150000); // Test 2  zero-decimal
        const dddsQuote = await upsertQuote(TEST_QUOTE_NUMBER_3DS, 'USD', 1500);  // Test 4  3DS success
        const bankQuote = await upsertQuote(TEST_QUOTE_NUMBER_BANK, 'USD', 1500); // bank transfer (us_bank_account) success
        const eurQuote = await upsertQuote(TEST_QUOTE_NUMBER_EUR, 'EUR', 1500);   // bank transfer (SEPA) success
        const failQuote = await upsertQuote(TEST_QUOTE_NUMBER_FAIL, 'USD', 1500); // Tests 3 & 6  decline / regeneration (reusable)

        // PayPal quotes — pay these with `paymentMethod: paypal`. The success-ending ones
        // (USD, JPY) each need their OWN quote for the same reason as above: once a webhook
        // marks them Paid, create() blocks re-payment. The cancel and NGN-reject quotes
        // never reach Paid, so they're reusable across runs.
        const ppUsdQuote = await upsertQuote(TEST_QUOTE_NUMBER_PP_USD, 'USD', 1500);       // PayPal happy path (USD)
        const ppJpyQuote = await upsertQuote(TEST_QUOTE_NUMBER_PP_JPY, 'JPY', 150000);     // PayPal zero-decimal (JPY)
        const ppCancelQuote = await upsertQuote(TEST_QUOTE_NUMBER_PP_CANCEL, 'USD', 1500); // PayPal cancel/abandon (reusable)
        const ppNgnQuote = await upsertQuote(TEST_QUOTE_NUMBER_PP_NGN, 'NGN', 1500);       // PayPal currency-guard reject (reusable)

        logger.info('--- Test fixture ready ---');
        logger.info(`Login email:     ${TEST_CUSTOMER_EMAIL}`);
        logger.info(`Login password:  ${TEST_CUSTOMER_PASSWORD}`);
        logger.info('quoteId values for POST /api/payment/create:');
        logger.info('  -- Stripe (paymentMethod: card | bank_transfer) --');
        logger.info(`  ${usdQuote._id}  ${usdQuote.quoteNumber}   (Test 1  card happy path, USD)`);
        logger.info(`  ${jpyQuote._id}  ${jpyQuote.quoteNumber}   (Test 2  zero-decimal, JPY — card only)`);
        logger.info(`  ${dddsQuote._id}  ${dddsQuote.quoteNumber}   (Test 4  3DS success, USD)`);
        logger.info(`  ${bankQuote._id}  ${bankQuote.quoteNumber}   (bank transfer / us_bank_account, USD)`);
        logger.info(`  ${eurQuote._id}  ${eurQuote.quoteNumber}   (bank transfer / SEPA, EUR)`);
        logger.info(`  ${failQuote._id}  ${failQuote.quoteNumber}   (Tests 3 & 6  decline / regeneration — reusable)`);
        logger.info('  -- PayPal (paymentMethod: paypal) --');
        logger.info(`  ${ppUsdQuote._id}  ${ppUsdQuote.quoteNumber}   (PayPal happy path, USD)`);
        logger.info(`  ${ppJpyQuote._id}  ${ppJpyQuote.quoteNumber}   (PayPal zero-decimal, JPY)`);
        logger.info(`  ${ppCancelQuote._id}  ${ppCancelQuote.quoteNumber}   (PayPal cancel/abandon — reusable)`);
        logger.info(`  ${ppNgnQuote._id}  ${ppNgnQuote.quoteNumber}   (PayPal currency-guard reject, NGN — reusable)`);
        process.exit(0);
    } catch (error) {
        logger.error('Error seeding test customer:', error);
        process.exit(1);
    }
};

seedTestCustomer();
