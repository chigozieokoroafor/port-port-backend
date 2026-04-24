import { TokenType } from "../../../models/enums/TokenType.enum";
import { EmailParams } from "../../../models/interfaces/Email.interface";
import { baseEmailTemplate } from "./baseTemplate";


export const verifyCustomerEmail = (params: EmailParams) => {
    const { firstName, inviteUrl } = params;
    
    return {
        subject: TokenType.EmailVerification,
        text: `Hi ${firstName},\n\n Welcome to Port2Port. Please click the link below to verify your account:\n${inviteUrl}\n\nThis link will expire in 30 minutes.\n\nBest regards,\nPort2Port Team`,
        html: baseEmailTemplate(
            "Port2Port Admin Invitation",
            `
            <h3>Hi ${firstName},</h3>

            <p>Click the button below to verify your account:</p>

            <p style="text-align: center;">
                <a href="${inviteUrl}" class="button">Verify</a>
            </p>
            
            <p>Or copy and paste this link into your browser:</p>

            <p style="word-break: break-all;">${inviteUrl}</p>
            
            <div class="warning-box">
                <p><strong>Note:</strong> This verification link will expire in 30 minutes.</p>
            </div>
            `
        ),
    };
};