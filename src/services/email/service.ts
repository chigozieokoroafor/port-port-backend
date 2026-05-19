import Mail from 'nodemailer/lib/mailer';
import { transporter } from './transporter';
import { inviteEmail } from './templates/inviteEmail';
import { passwordReset } from './templates/passwordReset';
import { quoteConfirmation } from './templates/generateQuote';
import { sentQuote } from './templates/sentQuote';
import { paymentConfirmation } from './templates/paymentConfirmation';
import { v4 as uuidv4 } from 'uuid';
import { IUser } from '../../models/User.model';
import moment from 'moment';
import Token from '../../models/Token.model';
import { TokenType } from '../../models/enums/TokenType.enum';
import { EmailParams } from '../../models/interfaces/Email.interface';
import { verifyCustomerEmail } from './templates/verifyCustomerEmail';
import { passwordConfirmation } from './templates/passwordConfirmation';
import { sendQuote } from './templates/sendQuote';
import { sendPaymentLink } from './templates/sendPaymentLink';

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

interface SendQuoteEmailParams{
    to: string;
    firstName: string;
    quoteId: string;
    quoteRequestId: string;
    quoteUrl: string;
}

interface SendPaymentLinkParams{
    to: string;
    firstName: string;
    paymentLink: string;
    quoteReference: string;
}

/**
 * Send verification mail to
 */

export const emailVerification = async (user: IUser) =>{
  let hash = uuidv4();
  hash = hash.replaceAll('-', '');
  const expiresIn = moment().add(30, 'minutes').format();
  const token = await Token.create({
    user: user._id,
    hash,
    expiresIn,
    type: TokenType.EmailVerification
  });
  const link = `${process.env.FRONTEND_URL}/verify?token=${token.hash}`
  const verifyParam: EmailParams = {
    to: user.email,
    firstName: user.firstName,
    inviteUrl: link
  }
  const template = verifyCustomerEmail(verifyParam);

  const mailOptions: Mail.Options = {
        from: {
            name: 'Port2Port',
            address: process.env.SMTP_FROM_EMAIL as string,
        },
        to:user.email,
        subject: template.subject,
        text: template.text,
        html: template.html,
    };
  await transporter.sendMail(mailOptions);
}

/**
 * Send password reset email
 */

export const sendResetPassword = async (user: IUser) =>{
  let hash = uuidv4();
  hash = hash.replaceAll('-', '');
  const expiresIn = moment().add(15, 'minutes').format();
  const token = await Token.create({
    user: user._id,
    hash,
    expiresIn,
    type: TokenType.ResetPassword
  });
  const link = `${process.env.FRONTEND_URL}/reset-password?token=${token.hash}`
  const resetParam: PasswordResetEmailParams = {
    to: user.email,
    firstName: user.firstName,
    resetUrl: link
  }
  const template = passwordReset(resetParam);

  const mailOptions: Mail.Options = {
        from: {
            name: 'Port2Port',
            address: process.env.SMTP_FROM_EMAIL as string,
        },
        to:user.email,
        subject: template.subject,
        text: template.text,
        html: template.html,
    };
  await transporter.sendMail(mailOptions);
}
/**
 * Send password change 
*/
export const sendChangeConfirmation = async (user: IUser) =>{
    const link = `${process.env.FRONTEND_URL}/user/dashboard`
    const confirmParam: PasswordResetEmailParams = {
        to: user.email,
        firstName: user.firstName,
        resetUrl: link
    }
    const template = passwordConfirmation(confirmParam);

    const mailOptions: Mail.Options = {
            from: {
                name: 'Port2Port',
                address: process.env.SMTP_FROM_EMAIL as string,
            },
            to:user.email,
            subject: template.subject,
            text: template.text,
            html: template.html,
        };
    await transporter.sendMail(mailOptions);
}

/**
 * Send invite email to new admin
 */

export const sendInviteEmail = async (user: IUser, inviterName: string): Promise<void> => {

     let hash = uuidv4();
      hash = hash.replaceAll('-', '');
      const expiresIn = moment().add(15, 'minutes').format();
      const token = await Token.create({
        user: user._id,
        hash,
        expiresIn,
        type: TokenType.InviteUser
      });

       const link = `${process.env.FRONTEND_URL}/activate/${token.hash}`
  const inviteParam: InviteEmailParams = {
    to: user.email,
    firstName: user.firstName,
    inviteUrl: link,
    inviterName
  }
  const template = inviteEmail(inviteParam);
  
    const mailOptions: Mail.Options = {
        from: {
            name: 'Port2Port',
            address: process.env.SMTP_FROM_EMAIL as string,
        },
        to: user.email,
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
 * Send quote request confirmation email
 */
export const sendQuoteEmailToCustomer= async (
    to: string,
    quoteId: string,
    quoteReferenceId: string,
    quoteRequestId: string,
    customerName: string
): Promise<void> => {
    const link = `${process.env.FRONTEND_URL}/quotes/${quoteId}`
    const param: SendQuoteEmailParams = {
        to,
        quoteId: quoteReferenceId,
        quoteRequestId,
        quoteUrl: link,
        firstName: customerName
    };
    const template = sendQuote(param);

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
 * Send Payment Link to Initiate Payment
 */
export const sendPaymentLinkEmail = async (params: SendPaymentLinkParams): Promise<void> => {
    const { to } = params;
    const template = sendPaymentLink(params);

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