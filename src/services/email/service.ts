import Mail from 'nodemailer/lib/mailer';
import { transporter } from './transporter';
import { inviteEmail } from './templates/inviteEmail';
import { passwordReset } from './templates/passwordReset';
import { quoteConfirmation } from './templates/generateQuote';
import { sentQuote } from './templates/sentQuote';
import { paymentConfirmation } from './templates/paymentConfirmation';

interface InviteEmailParams {
    to: string;
    firstName: string;
    inviteUrl: string;
    inviterName: string;
}

interface PasswordResetEmailParams {
    to: string;
    firstName: string;
    resetUrl: string;
}

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
 * Send invite email to new admin
 */
export const sendInviteEmail = async (params: InviteEmailParams): Promise<void> => {
    const { to } = params;
    const template = inviteEmail(params);

    const mailOptions: Mail.Options = {
        from: {
            name: 'Port2Port',
            address: process.env.SMTP_FROM_EMAIL as string,
        },
        to,
        subject: template.subject,
        text: template.text,
        html: template.html,
    };

    await transporter.sendMail(mailOptions);
};

/**
 * Send password reset email
 */
export const sendPasswordResetEmail = async (params: PasswordResetEmailParams): Promise<void> => {
    const { to } = params;
    const template = passwordReset(params);

    const mailOptions: Mail.Options = {
        from: {
            name: 'Port2Port',
            address: process.env.SMTP_FROM_EMAIL as string,
        },
        to,
        subject: template.subject,
        text: template.text,
        html: template.html,
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
    const template = quoteConfirmation(referenceId, customerName);

    const mailOptions: Mail.Options = {
        from: {
            name: 'Port2Port',
            address: process.env.SMTP_FROM_EMAIL as string,
        },
        to,
        subject: template.subject,
        text: template.text,
        html: template.html,
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
    const template = paymentConfirmation(
        customerName,
        amount,
        currency,
        paymentReference,
        receiptUrl
    );

    const mailOptions: Mail.Options = {
        from: {
            name: 'Port2Port',
            address: process.env.SMTP_FROM_EMAIL as string,
        },
        to,
        subject: template.subject,
        text: template.text,
        html: template.html,
    };

    await transporter.sendMail(mailOptions);
};

/**
 * Send quote email to customer
 */
export const sendQuoteEmail = async (params: QuoteEmailParams): Promise<void> => {
    const { to } = params;
    const template = sentQuote(params);

    const mailOptions: Mail.Options = {
        from: {
            name: 'Port2Port',
            address: process.env.SMTP_FROM_EMAIL as string,
        },
        to,
        subject: template.subject,
        text: template.text,
        html: template.html,
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

/**
 * Utility function to send custom emails
 */
export const sendEmail = async (
    to: string | string[],
    subject: string,
    text: string,
    html: string,
    fromName: string = 'Port2Port'
): Promise<void> => {
    const mailOptions: Mail.Options = {
        from: {
            name: fromName,
            address: process.env.SMTP_FROM_EMAIL as string,
        },
        to,
        subject,
        text,
        html,
    };

    await transporter.sendMail(mailOptions);
};