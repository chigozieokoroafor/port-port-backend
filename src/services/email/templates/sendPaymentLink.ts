import { baseEmailTemplate } from "./baseTemplate";

interface sendPaymentLinkParams {
    to: string;
    firstName: string;
    quoteReference: string;
    paymentLink: string;
}

export const sendPaymentLink = (params: sendPaymentLinkParams) => {
    const {  firstName, quoteReference, paymentLink } = params;
    
    return {
        subject: `${quoteReference} - Port2Port`,
        text: `Hi ${firstName},\n\nYour quote  of ${quoteReference} is ready for payment.\n\nPlease click the link to pay for ${quoteReference} quote:\n${paymentLink}\n\nBest regards,\nPort2Port Team`,
        html: baseEmailTemplate(
            `${quoteReference} - Port2Port`,
            `
            <h3>Hi ${firstName},</h3>

            <p>Your quote  of ${quoteReference} is ready for payment.. Kindly click link to pay for your quote</p>
            
            <p>If you did not make this change, Contact our 
            <a href="mailto:help@p2p.com">support team </a> 
            as soon as possible. Otherwise you may go to your dashboard to continue with your activities with us
            </p>

            <p style="text-align: center;">
                <a href="${paymentLink}" class="button">Pay for Quote</a>
            </p>

            <p>Or copy and paste this link into your browser:</p>
            
            <p style="word-break: break-all;">${paymentLink}</p>
            `
        ),
    };
};