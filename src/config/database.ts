import mongoose from 'mongoose';
import logger from '../utils/logger';
import { PrismaClient } from '../../generated/prisma';
import { pagination } from "prisma-extension-pagination"

export const connectDB = async (): Promise<void> => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI as string);
    logger.info(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    logger.error('MongoDB connection error:', error);
    process.exit(1);
  }
};

export const prisma = new PrismaClient(
  {
    log: ["error", "warn"],
  }
).$extends(pagination())