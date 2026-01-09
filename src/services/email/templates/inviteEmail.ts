interface InviteEmailParams {
    to: string;
    firstName: string;
    inviteUrl: string;
    inviterName: string;
}

export const inviteEmail = (params: InviteEmailParams) => {
    const { to, firstName, inviteUrl, inviterName } = params;
    
    return {
        subject: 'You have been invited to Port2Port Admin',
        text: `Hi ${firstName},\n\n${inviterName} has invited you to join the Port2Port admin team. Please click the link below to activate your account and set your password:\n${inviteUrl}\n\nThis link will expire in 7 days.\n\nBest regards,\nPort2Port Team`,
        html: `
            <!DOCTYPE html>
            <html>
                <head>
                    <style>
                        body {
                            font-family: Arial, sans-serif;
                            line-height: 1.6;
                            color: #333;
                        }
                        .container {
                            max-width: 600px;
                            margin: 0 auto;
                            padding: 20px;
                        }
                        .header {
                            background-color: #0066cc;
                            color: white;
                            padding: 20px;
                            text-align: center;
                        }
                        .content {
                            padding: 20px;
                            background-color: #f9f9f9;
                        }
                        .credentials {
                            background-color: #fff;
                            padding: 15px;
                            border-left: 4px solid #0066cc;
                            margin: 20px 0;
                            font-family: 'Courier New', monospace;
                        }
                        .button {
                            display: inline-block;
                            padding: 12px 24px;
                            background-color: #0066cc;
                            color: white;
                            text-decoration: none;
                            border-radius: 5px;
                            margin: 20px 0;
                        }
                        .warning {
                            background-color: #fff3cd;
                            padding: 15px;
                            border-left: 4px solid #ffc107;
                            margin: 20px 0;
                        }
                        .footer {
                            padding: 20px;
                            text-align: center;
                            font-size: 12px;
                            color: #666;
                        }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <div class="header">
                            <h2>Port2Port Admin Invitation</h2>
                        </div>
                        <div class="content">

                            <h3>Hi ${firstName},</h3>

                            <p><strong>${inviterName}</strong> has invited you to join the Port2Port admin team.</p>

                            <p>Click the button below to activate your account and set your password:</p>

                            <p style="text-align: center;">
                                <a href="${inviteUrl}" class="button">Activate Account</a>
                            </p>
                            
                            <p>Or copy and paste this link into your browser:</p>

                            <p style="word-break: break-all;">${inviteUrl}</p>
                            
                            <p><strong>Note:</strong> This invitation link will expire in 7 days.</p>
                        
                        </div>
                        <div class="footer">
                            <p>© ${new Date().getFullYear()} Port2Port. All rights reserved.</p>
                            <p>If you didn't expect this invitation, please ignore this email.</p>
                        </div>
                    </div>
                </body>
            </html>
        `,
    };
};