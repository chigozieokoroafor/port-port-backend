import dotenv from 'dotenv';
dotenv.config();

import { connectDB } from '../config/database';
import logger from '../utils/logger';
import Payment from '../models/Payment.model';
import Quote from '../models/Quote.model';

/**
 * Items 5-6 migration: existing Payment records predate the `currency` field.
 * The payment link was always created in the quote's currency, so backfill each
 * record's currency from its associated Quote's `pricing.currency`.
 *
 * Idempotent: only touches records where `currency` is missing, so it's safe to
 * re-run. Does NOT backfill stripeSessionId / stripePaymentIntentId — those aren't
 * recoverable from our own data and must come from Stripe if ever needed.
 *
 * Run: npx ts-node src/scripts/backfillPaymentCurrency.ts
 */
const backfillPaymentCurrency = async () => {
  try {
    await connectDB();

    // Only records with no currency set yet.
    const payments = await Payment.find({
      $or: [{ currency: { $exists: false } }, { currency: null }],
    });

    logger.info(`Found ${payments.length} payment(s) missing currency`);

    let updated = 0;
    let skipped = 0;

    for (const payment of payments) {
      const quote = await Quote.findById(payment.quoteId).select('pricing.currency');
      const currency = quote?.pricing?.currency?.toUpperCase();

      if (!currency) {
        // No quote or no currency on it — leave blank rather than guessing.
        logger.warn(`Skipping payment ${payment._id}: no currency on quote ${payment.quoteId}`);
        skipped++;
        continue;
      }

      payment.currency = currency;
      await payment.save();
      updated++;
    }

    logger.info(`Backfill complete: ${updated} updated, ${skipped} skipped`);
    process.exit(0);
  } catch (error) {
    logger.error('Error backfilling payment currency:', error);
    process.exit(1);
  }
};

backfillPaymentCurrency();
