import nodemailer from 'nodemailer';

// Create transporter
export const createTransporter = () => {
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

export const transporter = createTransporter();