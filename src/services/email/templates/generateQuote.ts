export const quoteConfirmation = (
    referenceId: string,
    customerName: string
) => {
    return {
        subject: `Quote Request Received - ${referenceId}`,
        text: `Hi ${customerName},\n\nWe have received your quote request (Reference: ${referenceId}).\n\nOur team will review your request and send you a quote within 24-48 hours.\n\nYou can track your quote status at: ${process.env.FRONTEND_URL}/track/${referenceId}\n\nBest regards,\nPort2Port Team`,
        html: `
            <!DOCTYPE html>
            <html>
                <head>
                    <style>
                        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                        .header { background-color: #0066cc; color: white; padding: 20px; text-align: center; }
                        .content { padding: 20px; background-color: #f9f9f9; }
                        .reference { background-color: #fff; padding: 15px; border-left: 4px solid #0066cc; margin: 20px 0; }
                        .button { display: inline-block; padding: 12px 24px; background-color: #0066cc; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
                        .footer { padding: 20px; text-align: center; font-size: 12px; color: #666; }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <div class="header">
                            <h2>Quote Request Received</h2>
                        </div>
                        <div class="content">
                            <h3>Hi ${customerName},</h3>

                            <p>Thank you for your interest in Port2Port shipping services.</p>

                            <div class="reference">
                                <strong>Reference Number:</strong> ${referenceId}
                            </div>

                            <p>We have received your quote request and our team will review it shortly. You will receive a detailed quote within 24-48 hours.</p>
                            
                            <p style="text-align: center;">
                                <a href="${process.env.FRONTEND_URL}/track/${referenceId}" class="button">Track Your Quote</a>
                            </p>
                            
                            <p>If you have any questions, please don't hesitate to contact us.</p>
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