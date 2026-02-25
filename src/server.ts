import dotenv from 'dotenv';
dotenv.config();

import app from './app';
import { connectDB } from './config/database';
import logger from './utils/logger';
import { Server } from 'http';
import { verifyEmailConnection } from './services/email/service';

const PORT = process.env.PORT || 5000;

let server: Server;

const startServer = async () => {
  try {
    // Connect to database
    await connectDB();

    // Check Email Service
    await verifyEmailConnection();
    
    // Start server
    server = app.listen(PORT, () => {
      const baseUrl = process.env.BACKEND_URL || 'http://localhost:' + PORT;
      const apiUrl = baseUrl.endsWith('/api') ? baseUrl : baseUrl + '/api';
      logger.info(`Server running in "${process.env.NODE_ENV}" mode on port ${PORT}`);
      logger.info(`Backend URL: ${baseUrl}`);
      console.log('\n🚀 Server is running!');
      console.log(`🌍 Backend URL: ${apiUrl}`);
      console.log(`🏥 Health check: http://localhost:${PORT}/api/health`);
      console.log(`📚 API: http://localhost:${PORT}/api\n`);
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
};

// Graceful shutdown
const gracefulShutdown = async (signal: string) => {
  logger.info(`${signal} received. Starting graceful shutdown...`);
  
  if (server) {
    server.close(() => {
      logger.info('HTTP server closed');
      
      // Close database connection
      process.exit(0);
    });

    // Force close after 10 seconds
    setTimeout(() => {
      logger.error('Forced shutdown after timeout');
      process.exit(1);
    }, 10000);
  } else {
    process.exit(0);
  }
};

// Handle shutdown signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason: Error) => {
  logger.error('Unhandled Rejection:', reason);
  gracefulShutdown('UNHANDLED_REJECTION');
});

// Handle uncaught exceptions
process.on('uncaughtException', (error: Error) => {
  logger.error('Uncaught Exception:', error);
  gracefulShutdown('UNCAUGHT_EXCEPTION');
});

startServer();