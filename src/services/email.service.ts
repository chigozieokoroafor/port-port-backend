import nodemailer from 'nodemailer';
import Mail from 'nodemailer/lib/mailer';

// Create transporter
const createTransporter = () => {
    // For development
    if (process.env.NODE_ENV === 'development') {
        return nodemailer.createTransport({
        host: process.env.SMTP_HOST || 'sandbox.smtp.mailtrap.io',
        port: parseInt(process.env.SMTP_PORT || '2525'),
        auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS,
        },
        });
    }

    // For production
    return nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT || '587'),
        secure: process.env.SMTP_SECURE === 'true',
        auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
        },
    });
};

const transporter = createTransporter();
console.log(transporter);

interface InviteEmailParams {
  to: string;
  firstName: string;
  inviteUrl: string;
  inviterName: string;
}

/**
 * Send invite email to new admin
 */
export const sendInviteEmail = async (params: InviteEmailParams): Promise<void> => {
    const { to, firstName, inviteUrl, inviterName } = params;

    const mailOptions: Mail.Options = {
        from: {
            name: 'Port2Port',
            address: process.env.SMTP_FROM_EMAIL as string,
        },
        to,
        subject: 'You have been invited to Port2Port Admin',
        text: `Hi ${firstName},\n\n${inviterName} has invited you to join the Port2Port admin team.\n\nPlease click the link below to activate your account:\n${inviteUrl}\n\nThis link will expire in 7 days.\n\nBest regards,\nPort2Port Team`,
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
                .button {
                display: inline-block;
                padding: 12px 24px;
                background-color: #0066cc;
                color: white;
                text-decoration: none;
                border-radius: 5px;
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
                <h1>Port2Port Admin Invitation</h1>
                </div>
                <div class="content">
                <h2>Hi ${firstName},</h2>
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

    await transporter.sendMail(mailOptions);
};

/**
 * Send quote request confirmation email
 */
export const sendQuoteConfirmationEmail = async (
  to: string,
  referenceId: string,
  customerName: string
): Promise<void> => {
  const mailOptions: Mail.Options = {
    from: {
      name: 'Port2Port',
      address: process.env.SMTP_FROM_EMAIL as string,
    },
    to,
    subject: `Quote Request Received - ${referenceId}`,
    text: `Hi ${customerName},\n\nWe have received your quote request (Reference: ${referenceId}).\n\nOur team will review your request and send you a quote within 24-48 hours.\n\nYou can track your quote status at: ${process.env.FRONTEND_URL}/track/${referenceId}\n\nBest regards,\nPort2Port Team`,
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background-color: #0066cc; color: white; padding: 20px; text-align: center; }
            .content { padding: 20px; background-color: #f9f9f9; }
            .reference { background-color: #fff; padding: 15px; border-left: 4px solid #0066cc; margin: 20px 0; }
            .button { display: inline-block; padding: 12px 24px; background-color: #0066cc; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
            .footer { padding: 20px; text-align: center; font-size: 12px; color: #666; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Quote Request Received</h1>
            </div>
            <div class="content">
              <h2>Hi ${customerName},</h2>
              <p>Thank you for your interest in Port2Port shipping services.</p>
              <div class="reference">
                <strong>Reference Number:</strong> ${referenceId}
              </div>
              <p>We have received your quote request and our team will review it shortly. You will receive a detailed quote within 24-48 hours.</p>
              <p style="text-align: center;">
                <a href="${process.env.FRONTEND_URL}/track/${referenceId}" class="button">Track Your Quote</a>
              </p>
              <p>If you have any questions, please don't hesitate to contact us.</p>
            </div>
            <div class="footer">
              <p>© ${new Date().getFullYear()} Port2Port. All rights reserved.</p>
            </div>
          </div>
        </body>
      </html>
    `,
  };

  await transporter.sendMail(mailOptions);
};

/**
 * Send payment confirmation email
 */
export const sendPaymentConfirmationEmail = async (
  to: string,
  customerName: string,
  amount: number,
  currency: string,
  paymentReference: string,
  receiptUrl: string
): Promise<void> => {
  const mailOptions: Mail.Options = {
    from: {
      name: 'Port2Port',
      address: process.env.SMTP_FROM_EMAIL as string,
    },
    to,
    subject: `Payment Confirmed - ${paymentReference}`,
    text: `Hi ${customerName},\n\nYour payment of ${currency} ${amount} has been confirmed.\n\nPayment Reference: ${paymentReference}\n\nYou can download your receipt at: ${receiptUrl}\n\nBest regards,\nPort2Port Team`,
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background-color: #28a745; color: white; padding: 20px; text-align: center; }
            .content { padding: 20px; background-color: #f9f9f9; }
            .payment-details { background-color: #fff; padding: 15px; border-left: 4px solid #28a745; margin: 20px 0; }
            .button { display: inline-block; padding: 12px 24px; background-color: #0066cc; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
            .footer { padding: 20px; text-align: center; font-size: 12px; color: #666; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>✓ Payment Confirmed</h1>
            </div>
            <div class="content">
              <h2>Hi ${customerName},</h2>
              <p>Your payment has been successfully processed.</p>
              <div class="payment-details">
                <p><strong>Amount Paid:</strong> ${currency} ${amount}</p>
                <p><strong>Payment Reference:</strong> ${paymentReference}</p>
              </div>
              <p style="text-align: center;">
                <a href="${receiptUrl}" class="button">Download Receipt</a>
              </p>
              <p>Your shipment will be processed shortly and you will receive tracking information once your vehicle is loaded.</p>
            </div>
            <div class="footer">
              <p>© ${new Date().getFullYear()} Port2Port. All rights reserved.</p>
            </div>
          </div>
        </body>
      </html>
    `,
  };

  await transporter.sendMail(mailOptions);
};

/**
 * Verify SMTP connection
 */
export const verifyEmailConnection = async (): Promise<boolean> => {
  try {
    await transporter.verify();
    console.log('✓ Email server is ready to send messages');
    return true;
  } catch (error) {
    console.error('✗ Email server connection failed:', error);
    return false;
  }
};