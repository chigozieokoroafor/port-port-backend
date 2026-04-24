import { baseEmailTemplate } from "./baseTemplate";

interface PasswordResetEmailParams {
    to: string;
    firstName: string;
    resetUrl: string;
}

export const passwordReset = (params: PasswordResetEmailParams) => {
    const {  firstName, resetUrl } = params;
    
    return {
        subject: 'Password Reset Request - Port2Port',
        text: `Hi ${firstName},\n\nWe received a request to reset your password.\n\nPlease click the link below to reset your password:\n${resetUrl}\n\nThis link will expire in 1 hour.\n\nIf you didn't request this, please ignore this email.\n\nBest regards,\nPort2Port Team`,
        html: baseEmailTemplate(
            "Password Reset Request",
            `
            <h3>Hi ${firstName},</h3>

            <p>We received a request to reset your password for your Port2Port account.</p>
            
            <p>Click the button below to reset your password:</p>

            <p style="text-align: center;">
                <a href="${resetUrl}" class="button">Reset Password</a>
            </p>

            <p>Or copy and paste this link into your browser:</p>
            
            <p style="word-break: break-all;">${resetUrl}</p>

            <div class="warning-box">
                <p><strong>⚠️ Important:</strong></p>
                <ul>
                    <li>This link will expire in <strong>1 hour</strong></li>
                    <li>If you didn't request this password reset, please ignore this email</li>
                    <li>Your password will remain unchanged unless you click the link above</li>
                </ul>
            </div>
            `
        ),
    };
};