// import { Request, Response } from 'express';
// import Payment from '../../../models/Payment.model';
// import { PaymentStatus } from '../../../models/enums/PaymentStatus.enum';
// import { PaymentProvider } from '../../../models/enums/PaymentProvider.enum';
// import { IPayment } from '../../../models/interfaces/Payment.interface';
// import { IQuote } from '../../../models/Quote.model';
// import logger from '../../../utils/logger';
// import { createPayPalOrder } from '../create-payment-v2/util';

// /**
//  * PayPal branch of `create` (guide Phase 2 section 2). Runs after the shared front-half
//  * (quote lookup, ownership, approval, already-paid guard) has passed.
//  *
//  * Mirrors the Stripe branch's persist-then-respond contract: create the PayPal order,
//  * store a Payment record (provider `paypal`, `paypalOrderId`, Unpaid) BEFORE returning,
//  * then hand the frontend the approval URL to redirect to. As with Stripe, no email or
//  * shipment happens here — the webhook (PAYMENT.CAPTURE.COMPLETED) is the source of truth.
//  */
// export const createPayPalPayment = async (
//     req: Request,
//     res: Response,
//     quote: IQuote,
//     existing: IPayment | null,
// ): Promise<Response> => {
//     // Return/cancel URLs are built by us, same principle as the Stripe success/cancel
//     // URLs. The return URL carries the quote ref so the return handler can look up the
//     // record; PayPal also appends `?token=<orderId>` on redirect.
//     const frontendUrl = process.env.FRONTEND_URL as string;
//     const returnUrl = `${process.env.BACKEND_URL}/api/payment/paypal/return?quoteRef=${quote.quoteNumber}`;
//     const cancelUrl = `${frontendUrl}/payment/cancel?quoteRef=${quote.quoteNumber}`;

//     const { orderId, approvalUrl } = await createPayPalOrder(quote, returnUrl, cancelUrl);

//     // Same atomic find-or-create keyed on the unique `quoteReference` as the Stripe
//     // branch, so concurrent inits converge on one record. The order id is stored
//     // immediately so a refund/dispute/support lookup can find it even if the buyer
//     // never returns from PayPal.
//     let payment: IPayment | null;
//     try {
//         payment = await Payment.findOneAndUpdate(
//             { quoteReference: quote.quoteNumber },
//             {
//                 $set: {
//                     provider: PaymentProvider.Paypal,
//                     paymentUrl: approvalUrl,
//                     paypalOrderId: orderId,
//                     // Lock the expected amount + currency from the quote at creation time.
//                     // Webhook fulfillment verifies the captured money against these.
//                     expectedAmount: quote.pricing.totalAmount,
//                     expectedCurrency: quote.pricing.currency?.toUpperCase(),
//                     updatedBy: req.user?._id,
//                 },
//                 $setOnInsert: {
//                     quoteId: quote._id,
//                     createdBy: req.user?._id,
//                     quoteReference: quote.quoteNumber,
//                     status: PaymentStatus.Unpaid,
//                 },
//             },
//             { new: true, upsert: true }
//         );
//     } catch (err: any) {
//         if (err?.code === 11000) {
//             payment = await Payment.findOne({ quoteReference: quote.quoteNumber });
//         } else {
//             throw err;
//         }
//     }

//     if (existing?.paypalOrderId && existing.paypalOrderId !== orderId) {
//         // A prior PayPal order for this quote is being superseded. PayPal orders expire
//         // on their own (no explicit cancel call in the SDK), and the webhook/return
//         // handlers are scoped so a stale order can't flip the fresh record — so this is
//         // just logged for traceability, mirroring the Stripe expire-old-session step.
//         logger.info(`Superseding previous PayPal order ${existing.paypalOrderId} for quote ${quote.quoteNumber}`);
//     }

//     return res.status(200).json({
//         success: true,
//         message: 'PayPal order created',
//         provider: PaymentProvider.Paypal,
//         approvalUrl,
//         orderId,
//     });
// };

