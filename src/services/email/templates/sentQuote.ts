interface QuoteEmailParams {
    to: string;
    customerName: string;
    quoteNumber: string;
    referenceId: string;
    pricing: any;
    terms: any;
    vehicle: any;
    route: any;
}

export const sentQuote = (params: QuoteEmailParams) => {
    const { customerName, quoteNumber, referenceId, pricing, terms, vehicle, route } = params;

    return {
        subject: `Your Shipping Quote - ${quoteNumber}`,
        text: `Hi ${customerName},\n\nThank you for your quote request (${referenceId}).\n\nWe are pleased to provide you with a shipping quote:\n\nQuote Number: ${quoteNumber}\nTotal Amount: ${pricing.currency} ${pricing.totalAmount}\n\nThis quote is valid until ${new Date(terms.validUntil).toLocaleDateString()}.\n\nTo proceed with payment, please visit: ${process.env.FRONTEND_URL}/quote/${quoteNumber}\n\nBest regards,\nPort2Port Team`,
        html: `
            <!DOCTYPE html>
            <html>
                <head>
                <style>
                    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                    .header { background-color: #28a745; color: white; padding: 20px; text-align: center; }
                    .content { padding: 20px; background-color: #f9f9f9; }
                    .quote-details { background-color: #fff; padding: 15px; border-left: 4px solid #28a745; margin: 20px 0; }
                    .pricing-table { width: 100%; border-collapse: collapse; margin: 20px 0; }
                    .pricing-table th, .pricing-table td { padding: 10px; text-align: left; border-bottom: 1px solid #ddd; }
                    .pricing-table th { background-color: #f8f9fa; font-weight: bold; }
                    .total-row { font-size: 1.2em; font-weight: bold; background-color: #e9ecef; }
                    .button { display: inline-block; padding: 12px 24px; background-color: #28a745; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
                    .footer { padding: 20px; text-align: center; font-size: 12px; color: #666; }
                    .info-section { margin: 15px 0; }
                </style>
                </head>
                <body>
                <div class="container">
                    <div class="header">
                    <h1>Your Shipping Quote</h1>
                    </div>
                    <div class="content">
                    <h2>Hi ${customerName},</h2>
                    <p>Thank you for your quote request. We are pleased to provide you with a shipping quote for your ${vehicle.year} ${vehicle.make} ${vehicle.model}.</p>
                    
                    <div class="quote-details">
                        <p><strong>Quote Number:</strong> ${quoteNumber}</p>
                        <p><strong>Reference ID:</strong> ${referenceId}</p>
                        <p><strong>Valid Until:</strong> ${new Date(terms.validUntil).toLocaleDateString()}</p>
                    </div>

                    <div class="info-section">
                        <h3>Shipping Route</h3>
                        <p><strong>From:</strong> ${route.originPort}, ${route.originCountry}</p>
                        <p><strong>To:</strong> ${route.destinationPort}, ${route.destinationCountry}</p>
                    </div>

                    <div class="info-section">
                        <h3>Vehicle Details</h3>
                        <p><strong>Vehicle:</strong> ${vehicle.year} ${vehicle.make} ${vehicle.model}</p>
                        <p><strong>VIN:</strong> ${vehicle.vin}</p>
                        <p><strong>Condition:</strong> ${vehicle.condition}</p>
                    </div>

                    <h3>Pricing Breakdown</h3>
                    <table class="pricing-table">
                        <tr>
                        <th>Item</th>
                        <th>Amount</th>
                        </tr>
                        <tr>
                        <td>Shipping Cost</td>
                        <td>${pricing.currency} ${pricing.shippingCost.toFixed(2)}</td>
                        </tr>
                        ${pricing.insuranceCost ? `
                        <tr>
                        <td>Insurance</td>
                        <td>${pricing.currency} ${pricing.insuranceCost.toFixed(2)}</td>
                        </tr>
                        ` : ''}
                        ${pricing.handlingFees ? `
                        <tr>
                        <td>Handling Fees</td>
                        <td>${pricing.currency} ${pricing.handlingFees.toFixed(2)}</td>
                        </tr>
                        ` : ''}
                        ${pricing.additionalCharges && pricing.additionalCharges.length > 0 ? pricing.additionalCharges.map((charge: any) => `
                        <tr>
                        <td>${charge.description}</td>
                        <td>${pricing.currency} ${charge.amount.toFixed(2)}</td>
                        </tr>
                        `).join('') : ''}
                        <tr class="total-row">
                        <td>Total Amount</td>
                        <td>${pricing.currency} ${pricing.totalAmount.toFixed(2)}</td>
                        </tr>
                    </table>

                    <div class="info-section">
                        <h3>Payment Terms</h3>
                        <p>${terms.paymentTerms}</p>
                        ${terms.specialConditions ? `
                        <h3>Special Conditions</h3>
                        <p>${terms.specialConditions}</p>
                        ` : ''}
                    </div>

                    <p style="text-align: center;">
                        <a href="${process.env.FRONTEND_URL}/quote/${quoteNumber}" class="button">Proceed to Payment</a>
                    </p>

                    <p>If you have any questions or would like to discuss this quote, please don't hesitate to contact us.</p>
                    </div>
                    <div class="footer">
                    <p>© ${new Date().getFullYear()} Port2Port. All rights reserved.</p>
                    <p>This quote is valid until ${new Date(terms.validUntil).toLocaleDateString()}</p>
                    </div>
                </div>
                </body>
            </html>
        `,
    };
};