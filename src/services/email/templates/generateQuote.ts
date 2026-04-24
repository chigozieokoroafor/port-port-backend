import { baseEmailTemplate } from "./baseTemplate";

export const quoteConfirmation = (
    referenceId: string,
    customerName: string
) => {
    return {
        subject: `Quote Request Received - ${referenceId}`,
        text: `Hi ${customerName},\n\nWe have received your quote request (Reference: ${referenceId}).\n\nOur team will review your request and send you a quote within 24-48 hours.\n\nYou can track your quote status at: ${process.env.FRONTEND_URL}/track/${referenceId}\n\nBest regards,\nPort2Port Team`,
        html: baseEmailTemplate(
            "Quote Request Received",
            `
            <h3>Hi ${customerName},</h3>

            <p>Thank you for your interest in Port2Port shipping services.</p>

            <div class="info-box">
                <strong>Reference Number:</strong> ${referenceId}
            </div>

            <p>We have received your quote request and our team will review it shortly. You will receive a detailed quote within 24-48 hours.</p>
            
            <p style="text-align: center;">
                <a href="${process.env.FRONTEND_URL}/track/${referenceId}" class="button">Track Your Quote</a>
            </p>
            
            <p>If you have any questions, please don't hesitate to contact us.</p>
            `
        ),
    };
};