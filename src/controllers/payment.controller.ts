import { Request, Response } from 'express';
import { catchAsync } from "../utils/catchAsync";
import Stripe from 'stripe';
import Payment from '../models/Payment.model';
import { PaymentStatus } from '../models/enums/PaymentStatus.enum';
import { IPayment } from '../models/interfaces/Payment.interface';
import { ApiError } from '../utils/ApiError';
import Shipment from '../models/Shipment.model';
import Quote from '../models/Quote.model';
import { createPaymentLink } from '../services/payment';
import { sendPaymentLinkEmail } from '../services/email';
import QuoteRequest from '../models/QuoteRequest.model';
import { Status } from '../models/enums/Status.enum';

export const create = catchAsync(async (req: Request, res: Response) =>{
    const {quoteId} = req.body;

    const quote = await Quote.findById(quoteId);
    if(!quote) throw new ApiError(400, 'Invalid quote');

    if(quote.status != Status.Approved) throw new ApiError(400, 'Payemnt Link can only be generated for approved quotes')

    const request = await QuoteRequest.findById(quote.quoteRequestId);

    const paymentLink =  await createPaymentLink(quote);

    let payment: IPayment | null = await Payment.findOne({quoteId: quote._id});

    if(payment && payment.status == PaymentStatus.Paid) throw new ApiError(400, 'Payment is already paid for');

    if(!payment){
            payment = await Payment.create({
                        quoteId: quote._id,
                        paymentUrl: paymentLink,
                        createdBy: req.user?._id,
                        quoteReference: quote.quoteNumber
                    });
        }else{
            payment.paymentUrl = paymentLink;
        }
    
        //send payment link mail
        await sendPaymentLinkEmail({
            to: request?.customer.email as string,
            firstName: request?.customer.fullName as string,
            quoteReference: quote.quoteNumber,
            paymentLink
        })

        await payment.save();

        return res.status(200).json({
            success: true,
            message: 'Payment link generated successfully',
            paymentLink
        });
});

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
            const payment = await Payment.findOne({quoteReference: quoteId, status: PaymentStatus.Unpaid});
            if(payment){
                await Payment.findOneAndUpdate({quoteReference: quoteId}, {
                status: PaymentStatus.Paid,
                paidAt: new Date(),
                amountPaid: paymentIntent.amount_total
            })

            //create Shipment
            await Shipment.create({
                quote: quoteId,
                payment: payment._id
            })
            }
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

export const getPayments = catchAsync(
    async (req: Request, res: Response) => {
        const {
            status,
            search,
            startDate,
            endDate,
            page = 1,
            limit = 10,
            customer,
        } = req.query;

        // Build filter
        const filter: any = {};

        if (status) {
            filter.status = status;
        }

        if (search) {
            filter.$or = [
                { name: { $regex: search, $options: 'i' } },
                // { 'customer.fullName': { $regex: search, $options: 'i' } },
                // { 'customer.email': { $regex: search, $options: 'i' } },
                // { 'vehicle.vin': { $regex: search, $options: 'i' } },
            ];
        }

        if (startDate || endDate) {
            filter.createdAt = {};
            if (startDate) filter.createdAt.$gte = new Date(startDate as string);
            if (endDate) filter.createdAt.$lte = new Date(endDate as string);
        }

        if (customer) {
            filter.createdBy = customer
        }

        // Pagination
        const pageNum: number = Number.parseInt(page as string, 10);
        const limitNum: number = Number.parseInt(limit as string, 10);
        const skip: number = (pageNum - 1) * limitNum;

        // Get total count
        const total = await Payment.countDocuments(filter);

        // Get requests
        const payments: IPayment[] | [] = await Payment.find(filter)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limitNum);

        res.status(200).json({
            success: true,
            data: {
                payments,
                pagination: {
                    page: pageNum,
                    limit: limitNum,
                    total,
                    pages: Math.ceil(total / limitNum),
                },
            },
        });
    }
);

export const getPaymentById = catchAsync( async (req: Request, res: Response)=>{
    const { id } = req.params;

        // Get associated quote if exists
        const payment: IPayment | null = await Payment.findOne({ _id: id }).populate(
            'createdBy',
            'firstName lastName email'
        );

        res.status(200).json({
            success: true,
            data: {
                payment
            },
        });
    }
)