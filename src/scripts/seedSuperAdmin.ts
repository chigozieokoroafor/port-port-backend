import dotenv from 'dotenv';
dotenv.config();

import { connectDB } from '../config/database';
import logger from '../utils/logger';
import User from '../models/User.model';
import { UserStatus } from '../models/enums/UserStatus.enum';
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
      tempPassword: password,
      firstName: 'Super',
      lastName: 'Admin',
      role: UserType.SuperAdmin,
      status: UserStatus.Active,
      isSubscribedToNewsletter: true,
      isAgreedToTermsAndConditions: true,
    });

    logger.info('SuperAdmin created successfully');
    process.exit(0);
  } catch (error) {
    logger.error('Error seeding SuperAdmin:', error);
    process.exit(1);
  }
};

seedSuperAdmin();
