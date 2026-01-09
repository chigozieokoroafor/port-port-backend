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
        html: `
            <!DOCTYPE html>
            <html>
                <head>
                    <style>
                        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                        .header { background-color: #28a745; color: white; padding: 20px; text-align: center; }
                        .content { padding: 20px; background-color: #f9f9f9; }
                        .payment-details { background-color: #fff; padding: 15px; border-left: 4px solid #28a745; margin: 20px 0; }
                        .button { display: inline-block; padding: 12px 24px; background-color: #0066cc; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
                        .footer { padding: 20px; text-align: center; font-size: 12px; color: #666; }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <div class="header">
                            <h2>✓ Payment Confirmed</h2>
                        </div>
                        <div class="content">
                            <h3>Hi ${customerName},</h3>

                            <p>Your payment has been successfully processed.</p>

                            <div class="payment-details">
                                <p><strong>Amount Paid:</strong> ${currency} ${amount}</p>
                                <p><strong>Payment Reference:</strong> ${paymentReference}</p>
                            </div>

                            <p style="text-align: center;">
                                <a href="${receiptUrl}" class="button">Download Receipt</a>
                            </p>
                            
                            <p>Your shipment will be processed shortly and you will receive tracking information once your vehicle is loaded.</p>
                        </div>
                        <div class="footer">
                            <p>© ${new Date().getFullYear()} Port2Port. All rights reserved.</p>
                        </div>
                    </div>
                </body>
            </html>
        `,
    };
};