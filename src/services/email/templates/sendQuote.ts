import { baseEmailTemplate } from "./baseTemplate";

interface SendQuoteParams {
    to: string;
    firstName: string;
    quoteId: string;
    quoteRequestId: string;
    quoteUrl: string;
}

export const sendQuote = (params: SendQuoteParams) => {
    const {  firstName, quoteId, quoteRequestId, quoteUrl } = params;

    return {
        subject: `${quoteId} - Port2Port`,
        text: `Hi ${firstName},\n\nYour quote request of ${quoteId} has been reviewed.\n\nPlease click the link below to view quote:\n${quoteUrl}\n\nBest regards,\nPort2Port Team`,
        html: baseEmailTemplate(
            `${quoteId} - Port2Port`,
            `
            <h3>Hi ${firstName},</h3>

            <p>Your quote request of ${quoteId} has been reviewed. Kindly click link to view quote generated</p>
            
            <p>If you did not make this change, Contact our 
            <a href="mailto:help@p2p.com">support team </a> 
            as soon as possible. Otherwise you may go to your dashboard to continue with your activities with us
            </p>

            <p style="text-align: center;">
                <a href="${quoteUrl}" class="button">View Quote</a>
            </p>

            <p>Or copy and paste this link into your browser:</p>
            
            <p style="word-break: break-all;">${quoteUrl}</p>
            `
        ),
    };
};