import Stripe from 'stripe';
import { IQuote } from '../../models/Quote.model';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string)

export const createPaymentLink = async (quote: IQuote)=>{
    const price = quote.pricing.totalAmount * 100;
    let product = await stripe.products.retrieve(quote.productId);
    if(!product){
        product = await stripe.products.create({
                active: true,
                name:quote.quoteNumber,
                default_price_data:{
                    currency: quote.pricing.currency,
                    unit_amount_decimal: price.toString()
                },        
            });
    }

    const paymentLink = await stripe.paymentLinks.create({
        line_items:[{
            price_data:{
                currency: quote.pricing.currency,
                product: product.id,
                unit_amount: price,
            },
            quantity: 1,
        }],
        metadata:{
            "quoteRef":quote.quoteNumber
        }
    })

    quote.productId = product.id;
    quote.save();

    return paymentLink.url;
}
