import express, { Application, Router } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import routes from './routes';
import { errorHandler } from './middleware/errorHandler.middleware';
import { notFound } from './middleware/notFound.middleware';
import webhookRoutes from './routes/webhook.routes';

const app: Application = express();

// Security middleware - Configure helmet for API usage
app.use(
  helmet({
    contentSecurityPolicy: false, // Disable CSP for API
    crossOriginEmbedderPolicy: false,
  })
);

// CORS configuration
app.use(
  cors({
    // Allow all origins in development if not set
    origin: process.env.FRONTEND_URL || '*',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

// Webhook routes are mounted at the app root, BEFORE the global JSON parser, so each
// provider's route controls its own body handling (Stripe needs the raw bytes for its
// HMAC signature; PayPal parses JSON itself). Paths are provider-scoped inside the router
// (/stripe/webhook, /paypal/webhook).
app.use('/', webhookRoutes);

// Body parsing
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Logging
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

// API routes
app.use('/api', routes);
 
// Error handling
app.use(notFound);
app.use(errorHandler);

export default app;