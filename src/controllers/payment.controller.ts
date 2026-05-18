import { Request, Response } from 'express';
import { catchAsync } from "../utils/catchAsync";
import Stripe from 'stripe';
import Payment from '../models/Payment.model';
import { PaymentStatus } from '../models/enums/PaymentStatus.enum';

/**
 * @desc    Webhook listening to stripe payment events
 * @route   POST /api/payment/webhook
 * @access  Admin
 */
export const webhook = catchAsync(async (req: Request, res: Response)=>{
    let event: Stripe.Event;
    const signature: string | string[] = req.headers['stripe-signature'] || '';
    const stripe: Stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string)

    try {
        console.log({body : req.body.toString('utf8')})
        event = stripe.webhooks.constructEvent(
            req.body.toString('utf8'), 
            signature,
            process.env.STRIPE_WEBHOOK_KEY || ''
        );

    } catch (err: any) {
      console.log(`Webhook signature verification failed.`, err.message);
      return res.sendStatus(400);
    }
try{
     switch (event.type) {

    case 'checkout.session.completed':
    //case 'charge.succeeded':
    //case 'payment_intent.succeeded':
        const paymentIntent = event.data.object;
        const quoteId: string | undefined = paymentIntent.metadata?.quoteRef;
        if(quoteId){
            await Payment.findOneAndUpdate({quoteReference: quoteId}, {
                status: PaymentStatus.Paid,
                paidAt: new Date(),
                amountPaid: paymentIntent.amount_total
            })

        }
        //send customer email
        console.log(`Quote ${quoteId} paid successfully`);
      break;
    case 'payment_intent.payment_failed': {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        const quoteId: string | null = paymentIntent.metadata?.quoteId;
        
        if (quoteId) {
          await Payment.findOneAndUpdate({quoteReference: quoteId}, {
                status: PaymentStatus.Failed,
                updatedAt: new Date()
            })
          //send customer email
          console.log(`Quote ${quoteId} failed`);
        }
        break;
    }
    default:
        console.log(`Unhandled event type: ${event.type}`);
  }
  res.status(200).json({ received: true });
}
catch (error: any) {
    console.error('Webhook processing error:', error);
    res.status(200).json({ error: 'Webhook processing failed', message: error.message });
  }
})