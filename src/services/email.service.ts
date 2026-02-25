import { sub } from 'date-fns';
import { v4 as uuidv4 } from 'uuid';
import nodemailer from 'nodemailer';
import Mail from 'nodemailer/lib/mailer';
import { IUser } from '../models/User.model';
import moment from 'moment';
import Token from '../models/Token.model';
import { TokenType } from '../models/enums/TokenType.enum';

 export async function sendTestEmail(userEmail: string, subject: TokenType, html: string){
  const testAccount = await nodemailer.createTestAccount();


  console.log("Test account created:");
  console.log("  User: %s", testAccount.user);
  console.log("  Pass: %s", testAccount.pass);

  const transporter = nodemailer.createTransport({
    host: testAccount.smtp.host,
    port: testAccount.smtp.port,
    secure: testAccount.smtp.secure,
    auth: {
      user: testAccount.user,
      pass: testAccount.pass,
    },
  });

   const info = await transporter.sendMail({
    from: `"Test App" <${testAccount.user}>`,
    to: userEmail,
    subject: subject,
    html: html,
  });

  console.log("Message sent: %s", info.messageId);
  console.log("Preview: %s", nodemailer.getTestMessageUrl(info));
}

export const emailVerification = async (user: IUser) =>{
  let hash = uuidv4();
  hash = hash.replace(/-/g, '');
  const expiresIn = moment().add(30, 'minutes').format();
  const token = await Token.create({
    user: user._id,
    hash,
    expiresIn,
    type: TokenType.EmailVerification
  });
  const link = `${process.env.FRONTEND_URL}/verify-email?token=${token.hash}`
  const message = `<p>Please verify your email with the link below</p>
        <p>${link}</p>`
  await sendTestEmail(user.email,TokenType.EmailVerification, message).catch(console.error);
  return link;
}

export const sendResetPassword = async (user: IUser) =>{
  let hash = uuidv4();
  hash = hash.replace(/-/g, '');
  const expiresIn = moment().add(15, 'minutes').format();
 
  const token = await Token.create({
    user: user._id,
    hash,
    expiresIn,
    type: TokenType.ResetPassword
  });

  const link = `${process.env.FRONTEND_URL}/update-password?token=${token.hash}`
  const message = `<p>Please clink the link to reset password</p>
        <p>${link}</p>`
  await sendTestEmail(user.email,TokenType.ResetPassword, message).catch(console.error);
  return link;
}

export const sendInviteMail = async (user: IUser) =>{
  let hash = uuidv4();
  hash = hash.replace(/-/g, '');
  const expiresIn = moment().add(15, 'minutes').format();
  const token = await Token.create({
    user: user._id,
    hash,
    expiresIn,
    type: TokenType.InviteUser
  });
  const link = `${process.env.FRONTEND_URL}/activate/${token.hash}`
  const message = `<p>Please clink the link to accept admin invite</p>
        <p>${link}</p>`
  await sendTestEmail(user.email,TokenType.InviteUser, message).catch(console.error);
  return link;
}


// Create transporter
const createTransporter = () => {
  // For development - Mailtrap
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

  // For production - Real SMTP server
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
};

const transporter = createTransporter();

interface InviteEmailParams {
  to: string;
  firstName: string;
  inviteUrl: string;
  inviterName: string;
  tempPassword: string;
}



/**
 * Send invite email to new admin
 */
export const sendInviteEmail = async (params: InviteEmailParams): Promise<void> => {
  const { to, firstName, inviteUrl, inviterName, tempPassword } = params;

  const mailOptions: Mail.Options = {
    from: {
      name: 'Port2Port',
      address: process.env.SMTP_FROM_EMAIL as string,
    },
    to,
    subject: 'You have been invited to Port2Port Admin',
    text: `Hi ${firstName},\n\n${inviterName} has invited you to join the Port2Port admin team.\n\nYour temporary credentials:\nEmail: ${to}\nTemporary Password: ${tempPassword}\n\nPlease click the link below to activate your account and set your permanent password:\n${inviteUrl}\n\nThis link will expire in 7 days.\n\nBest regards,\nPort2Port Team`,
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
              <h1>Port2Port Admin Invitation</h1>
            </div>
            <div class="content">
              <h2>Hi ${firstName},</h2>
              <p><strong>${inviterName}</strong> has invited you to join the Port2Port admin team.</p>
              
              <div class="credentials">
                <p><strong>Your Temporary Credentials:</strong></p>
                <p>Email: <strong>${to}</strong></p>
                <p>Temporary Password: <strong>${tempPassword}</strong></p>
              </div>

              <div class="warning">
                <p><strong>⚠️ Important:</strong></p>
                <p>This is a temporary password. You must activate your account and set a permanent password.</p>
              </div>

              <p>Click the button below to activate your account and set your permanent password:</p>
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

interface PasswordResetEmailParams {
  to: string;
  firstName: string;
  resetUrl: string;
}

/**
 * Send password reset email
 */
export const sendPasswordResetEmail = async (params: PasswordResetEmailParams): Promise<void> => {
  const { to, firstName, resetUrl } = params;

  const mailOptions: Mail.Options = {
    from: {
      name: 'Port2Port',
      address: process.env.SMTP_FROM_EMAIL as string,
    },
    to,
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
              <h1>🔐 Password Reset Request</h1>
            </div>
            <div class="content">
              <h2>Hi ${firstName},</h2>
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

/**
 * Send quote email to customer
 */
export const sendQuoteEmail = async (params: QuoteEmailParams): Promise<void> => {
  const { to, customerName, quoteNumber, referenceId, pricing, terms, vehicle, route } = params;

  const mailOptions: Mail.Options = {
    from: {
      name: 'Port2Port',
      address: process.env.SMTP_FROM_EMAIL as string,
    },
    to,
    subject: `Your Shipping Quote - ${quoteNumber}`,
    text: `Hi ${customerName},\n\nThank you for your quote request (${referenceId}).\n\nWe are pleased to provide you with a shipping quote:\n\nQuote Number: ${quoteNumber}\nTotal Amount: ${pricing.currency} ${pricing.totalAmount}\n\nThis quote is valid until ${new Date(terms.validUntil).toLocaleDateString()}.\n\nTo proceed with payment, please visit: ${process.env.FRONTEND_URL}/quote/${quoteNumber}\n\nBest regards,\nPort2Port Team`,
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background-color: #28a745; color: white; padding: 20px; text-align: center; }
            .content { padding: 20px; background-color: #f9f9f9; }
            .quote-details { background-color: #fff; padding: 15px; border-left: 4px solid #28a745; margin: 20px 0; }
            .pricing-table { width: 100%; border-collapse: collapse; margin: 20px 0; }
            .pricing-table th, .pricing-table td { padding: 10px; text-align: left; border-bottom: 1px solid #ddd; }
            .pricing-table th { background-color: #f8f9fa; font-weight: bold; }
            .total-row { font-size: 1.2em; font-weight: bold; background-color: #e9ecef; }
            .button { display: inline-block; padding: 12px 24px; background-color: #28a745; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
            .footer { padding: 20px; text-align: center; font-size: 12px; color: #666; }
            .info-section { margin: 15px 0; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Your Shipping Quote</h1>
            </div>
            <div class="content">
              <h2>Hi ${customerName},</h2>
              <p>Thank you for your quote request. We are pleased to provide you with a shipping quote for your ${vehicle.year} ${vehicle.make} ${vehicle.model}.</p>
              
              <div class="quote-details">
                <p><strong>Quote Number:</strong> ${quoteNumber}</p>
                <p><strong>Reference ID:</strong> ${referenceId}</p>
                <p><strong>Valid Until:</strong> ${new Date(terms.validUntil).toLocaleDateString()}</p>
              </div>

              <div class="info-section">
                <h3>Shipping Route</h3>
                <p><strong>From:</strong> ${route.originPort}, ${route.originCountry}</p>
                <p><strong>To:</strong> ${route.destinationPort}, ${route.destinationCountry}</p>
              </div>

              <div class="info-section">
                <h3>Vehicle Details</h3>
                <p><strong>Vehicle:</strong> ${vehicle.year} ${vehicle.make} ${vehicle.model}</p>
                <p><strong>VIN:</strong> ${vehicle.vin}</p>
                <p><strong>Condition:</strong> ${vehicle.condition}</p>
              </div>

              <h3>Pricing Breakdown</h3>
              <table class="pricing-table">
                <tr>
                  <th>Item</th>
                  <th>Amount</th>
                </tr>
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
                  <td>Total Amount</td>
                  <td>${pricing.currency} ${pricing.totalAmount.toFixed(2)}</td>
                </tr>
              </table>

              <div class="info-section">
                <h3>Payment Terms</h3>
                <p>${terms.paymentTerms}</p>
                ${terms.specialConditions ? `
                <h3>Special Conditions</h3>
                <p>${terms.specialConditions}</p>
                ` : ''}
              </div>

              <p style="text-align: center;">
                <a href="${process.env.FRONTEND_URL}/quote/${quoteNumber}" class="button">Proceed to Payment</a>
              </p>

              <p>If you have any questions or would like to discuss this quote, please don't hesitate to contact us.</p>
            </div>
            <div class="footer">
              <p>© ${new Date().getFullYear()} Port2Port. All rights reserved.</p>
              <p>This quote is valid until ${new Date(terms.validUntil).toLocaleDateString()}</p>
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