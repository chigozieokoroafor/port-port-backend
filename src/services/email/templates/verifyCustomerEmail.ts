import { TokenType } from "../../../models/enums/TokenType.enum";
import { EmailParams } from "../../../models/interfaces/Email.interface";


export const verifyCustomerEmail = (params: EmailParams) => {
    const { firstName, inviteUrl } = params;
    
    return {
        subject: TokenType.EmailVerification,
        text: `Hi ${firstName},\n\n Welcome to Port2Port. Please click the link below to verify your account:\n${inviteUrl}\n\nThis link will expire in 30 minutes.\n\nBest regards,\nPort2Port Team`,
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

                            <p>Click the button below to verify your account:</p>

                            <p style="text-align: center;">
                                <a href="${inviteUrl}" class="button">Verify</a>
                            </p>
                            
                            <p>Or copy and paste this link into your browser:</p>

                            <p style="word-break: break-all;">${inviteUrl}</p>
                            
                            <p><strong>Note:</strong> This verification link will expire in 30 minutes.</p>
                        
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