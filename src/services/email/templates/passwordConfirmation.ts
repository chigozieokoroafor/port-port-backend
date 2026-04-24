import { baseEmailTemplate } from "./baseTemplate";

interface PasswordResetEmailParams {
    to: string;
    firstName: string;
    resetUrl: string;
}

export const passwordConfirmation = (params: PasswordResetEmailParams) => {
    const {  firstName, resetUrl } = params;
    
    return {
        subject: 'Password Reset Request - Port2Port',
        text: `Hi ${firstName},\n\nWe received a request to reset your password.\n\nPlease click the link below to reset your password:\n${resetUrl}\n\nThis link will expire in 1 hour.\n\nIf you didn't request this, please ignore this email.\n\nBest regards,\nPort2Port Team`,
        html: baseEmailTemplate(
            "Password Reset Request",
            `
            <h3>Hi ${firstName},</h3>

            <p>We are sending this mail to confirm the password for your Port2Port account has been changed.</p>
            
            <p>If you did not make this change, Contact our 
            <a href="mailto:help@p2p.com">support team </a> 
            as soon as possible. Otherwise you may go to your dashboard to continue with your activities with us
            </p>

            <p style="text-align: center;">
                <a href="${resetUrl}" class="button">Go to Dashboard</a>
            </p>

            <p>Or copy and paste this link into your browser:</p>
            
            <p style="word-break: break-all;">${resetUrl}</p>
            `
        ),
    };
};