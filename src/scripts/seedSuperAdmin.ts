import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';
import { connectDB } from '../config/database';
import AdminUser from '../models/AdminUser.model';
import logger from '../utils/logger';
import User from '../models/User.model';
import { UserType } from '../models/enums/UserType.enum';

const seedSuperAdmin = async () => {
  try {
    await connectDB();

    const email = process.env.SUPERADMIN_EMAIL;
    const password = process.env.SUPERADMIN_PASSWORD;

    if (!email || !password) {
      throw new Error('SUPERADMIN_EMAIL and SUPERADMIN_PASSWORD must be set in .env');
    }

    const existingAdmin = await User.findOne({ email });

    if (existingAdmin) {
      logger.info('SuperAdmin already exists');
      process.exit(0);
    }

    await User.create({
      email,
      password: password,
      firstName: 'Super',
      lastName: 'Admin',
      role: UserType.SuperAdmin,
      status: 'active',
    });

    logger.info('SuperAdmin created successfully');
    process.exit(0);
  } catch (error) {
    logger.error('Error seeding SuperAdmin:', error);
    process.exit(1);
  }
};

seedSuperAdmin();
