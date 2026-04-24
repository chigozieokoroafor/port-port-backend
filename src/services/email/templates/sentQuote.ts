import { baseEmailTemplate } from "./baseTemplate";

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
        html: baseEmailTemplate(
            "Your Shipping Quote",
            `
            <h3>Hi ${customerName},</h3>
            <p>Thank you for your quote request. We are pleased to provide you with a shipping quote for your ${vehicle.year} ${vehicle.make} ${vehicle.model}.</p>
            
            <div class="info-box">
                <p><strong>Quote Number:</strong> ${quoteNumber}</p>
                <p><strong>Reference ID:</strong> ${referenceId}</p>
                <p><strong>Valid Until:</strong> ${new Date(terms.validUntil).toLocaleDateString()}</p>
            </div>

            <div style="margin: 20px 0;">
                <h4 style="margin-bottom: 10px; color: #0066cc;">Shipping Route</h4>
                <p style="margin: 5px 0;"><strong>From:</strong> ${route.originPort}, ${route.originCountry}</p>
                <p style="margin: 5px 0;"><strong>To:</strong> ${route.destinationPort}, ${route.destinationCountry}</p>
            </div>

            <div style="margin: 20px 0;">
                <h4 style="margin-bottom: 10px; color: #0066cc;">Vehicle Details</h4>
                <p style="margin: 5px 0;"><strong>Vehicle:</strong> ${vehicle.year} ${vehicle.make} ${vehicle.model}</p>
                <p style="margin: 5px 0;"><strong>VIN:</strong> ${vehicle.vin}</p>
                <p style="margin: 5px 0;"><strong>Condition:</strong> ${vehicle.condition}</p>
            </div>

            <h4 style="margin-top: 30px; margin-bottom: 10px; color: #0066cc;">Pricing Breakdown</h4>
            <table class="pricing-table">
                <thead>
                    <tr>
                        <th>Item</th>
                        <th>Amount</th>
                    </tr>
                </thead>
                <tbody>
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
                        <td><strong>Total Amount</strong></td>
                        <td><strong>${pricing.currency} ${pricing.totalAmount.toFixed(2)}</strong></td>
                    </tr>
                </tbody>
            </table>

            <div style="margin-top: 30px;">
                <h4 style="margin-bottom: 10px; color: #0066cc;">Payment Terms</h4>
                <p>${terms.paymentTerms}</p>
                ${terms.specialConditions ? `
                <h4 style="margin-bottom: 10px; color: #0066cc;">Special Conditions</h4>
                <p>${terms.specialConditions}</p>
                ` : ''}
            </div>

            <p style="text-align: center; margin-top: 40px;">
                <a href="${process.env.FRONTEND_URL}/quote/${quoteNumber}" class="button">Proceed to Payment</a>
            </p>

            <div class="divider"></div>

            <p>If you have any questions or would like to discuss this quote, please don't hesitate to contact us.</p>
            `
        ),
    };
};