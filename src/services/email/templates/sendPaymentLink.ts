import { baseEmailTemplate } from "./baseTemplate";

interface sendPaymentLinkParams {
    to: string;
    firstName: string;
    quoteReference: string;
    paymentLink: string;
    amount: number;
    currency: string;
}

export const sendPaymentLink = (params: sendPaymentLinkParams) => {
    const { firstName, quoteReference, paymentLink, amount, currency } = params;

    const formattedAmount = `${currency} ${amount.toFixed(2)}`;

    return {
        subject: `Payment request for quote ${quoteReference} - Port2Port`,
        text: `Hi ${firstName},\n\nYour quote ${quoteReference} is ready for payment.\n\nAmount due: ${formattedAmount}\n\nPlease use the secure link below to complete your payment:\n${paymentLink}\n\nIf you have any questions about this quote, contact our support team at help@p2p.com.\n\nBest regards,\nPort2Port Team`,
        html: baseEmailTemplate(
            `Payment request for quote ${quoteReference}`,
            `
            <h3>Hi ${firstName},</h3>

            <p>Your quote <strong>${quoteReference}</strong> is ready for payment. Please review the amount due and complete your payment using the secure link below.</p>

            <div class="info-box">
                <p><strong>Quote Reference:</strong> ${quoteReference}</p>
                <p><strong>Amount Due:</strong> ${formattedAmount}</p>
            </div>

            <p style="text-align: center;">
                <a href="${paymentLink}" class="button">Pay Now</a>
            </p>

            <p>Or copy and paste this link into your browser:</p>

            <p style="word-break: break-all;">${paymentLink}</p>

            <p>If you have any questions about this quote, contact our
            <a href="mailto:help@p2p.com">support team</a>.</p>
            `
        ),
    };
};
