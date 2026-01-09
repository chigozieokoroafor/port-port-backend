interface PasswordResetEmailParams {
    to: string;
    firstName: string;
    resetUrl: string;
}

export const passwordReset = (params: PasswordResetEmailParams) => {
    const { to, firstName, resetUrl } = params;
    
    return {
        subject: 'Password Reset Request - Port2Port',
        text: `Hi ${firstName},\n\nWe received a request to reset your password.\n\nPlease click the link below to reset your password:\n${resetUrl}\n\nThis link will expire in 1 hour.\n\nIf you didn't request this, please ignore this email.\n\nBest regards,\nPort2Port Team`,
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
                            background-color: #dc3545;
                            color: white;
                            padding: 20px;
                            text-align: center;
                        }
                        .content {
                            padding: 20px;
                            background-color: #f9f9f9;
                        }
                        .button {
                            display: inline-block;
                            padding: 12px 24px;
                            background-color: #dc3545;
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
                            <h2>🔐 Password Reset Request</h2>
                        </div>
                        <div class="content">
                            <h3>Hi ${firstName},</h3>

                            <p>We received a request to reset your password for your Port2Port admin account.</p>
                            
                            <p>Click the button below to reset your password:</p>

                            <p style="text-align: center;">
                                <a href="${resetUrl}" class="button">Reset Password</a>
                            </p>

                            <p>Or copy and paste this link into your browser:</p>
                            
                            <p style="word-break: break-all;">${resetUrl}</p>

                            <div class="warning">
                                <p><strong>⚠️ Important:</strong></p>
                                <ul>
                                    <li>This link will expire in <strong>1 hour</strong></li>
                                    <li>If you didn't request this password reset, please ignore this email</li>
                                    <li>Your password will remain unchanged unless you click the link above</li>
                                </ul>
                            </div>
                        </div>
                        <div class="footer">
                            <p>© ${new Date().getFullYear()} Port2Port. All rights reserved.</p>
                            <p>This is an automated email, please do not reply.</p>
                        </div>
                    </div>
                </body>
            </html>
        `,
    };
};