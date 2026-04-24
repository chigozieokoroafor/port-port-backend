import { baseEmailTemplate } from "./baseTemplate";

interface InviteEmailParams {
    to: string;
    firstName: string;
    inviteUrl: string;
    inviterName: string;
}

export const inviteEmail = (params: InviteEmailParams) => {
    const { firstName, inviteUrl, inviterName } = params;
    
    return {
        subject: 'You have been invited to Port2Port Admin',
        text: `Hi ${firstName},\n\n${inviterName} has invited you to join the Port2Port admin team. Please click the link below to activate your account and set your password:\n${inviteUrl}\n\nThis link will expire in 7 days.\n\nBest regards,\nPort2Port Team`,
        html: baseEmailTemplate(
            "Port2Port Admin Invitation",
            `
            <h3>Hi ${firstName},</h3>

            <p><strong>${inviterName}</strong> has invited you to join the Port2Port admin team.</p>

            <p>Click the button below to activate your account and set your password:</p>

            <p style="text-align: center;">
                <a href="${inviteUrl}" class="button">Activate Account</a>
            </p>
            
            <p>Or copy and paste this link into your browser:</p>

            <p style="word-break: break-all;">${inviteUrl}</p>
            
            <div class="info-box">
                <p><strong>Note:</strong> This invitation link will expire in 7 days.</p>
            </div>
            `
        ),
    };
};