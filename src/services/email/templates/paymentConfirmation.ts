import { baseEmailTemplate } from "./baseTemplate";

export const paymentConfirmation = (
    customerName: string,
    amount: number,
    currency: string,
    paymentReference: string,
    receiptUrl: string
) => {
    return {
        subject: `Payment Confirmed - ${paymentReference}`,
        text: `Hi ${customerName},\n\nYour payment of ${currency} ${amount} has been confirmed.\n\nPayment Reference: ${paymentReference}\n\nYou can download your receipt at: ${receiptUrl}\n\nBest regards,\nPort2Port Team`,
        html: baseEmailTemplate(
            "Payment Confirmed",
            `
            <h3>Hi ${customerName},</h3>

            <p>Your payment has been successfully processed.</p>

            <div class="info-box">
                <p><strong>Amount Paid:</strong> ${currency} ${amount}</p>
                <p><strong>Payment Reference:</strong> ${paymentReference}</p>
            </div>

            <p style="text-align: center;">
                <a href="${receiptUrl}" class="button">Download Receipt</a>
            </p>
            
            <p>Your shipment will be processed shortly and you will receive tracking information once your vehicle is loaded.</p>
            `
        ),
    };
};