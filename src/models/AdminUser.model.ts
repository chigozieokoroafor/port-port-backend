import mongoose, { Document, Schema, Model } from 'mongoose';
import bcrypt from 'bcryptjs';

export interface IAdminUser extends Document {
    email: string;
    password: string;
    tempPassword:string;
    firstName: string;
    lastName: string;
    role: 'admin' | 'superadmin';
    status: 'pending' | 'active' | 'suspended';
    invitedBy?: mongoose.Types.ObjectId;
    inviteToken?: string;
    inviteTokenExpiry?: Date;
    passwordResetToken?: string;
    passwordResetExpiry?: Date;
    lastLogin?: Date;
    createdAt: Date;
    updatedAt: Date;
    
    comparePassword(candidatePassword: string): Promise<boolean>;
    getFullName(): string;
}

// Mongoose schema
const adminUserSchema = new Schema<IAdminUser>(
    {
        email: {
            type: String,
            required: [true, 'Email is required'],
            unique: true,
            lowercase: true,
            trim: true,
            match: [
                /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/,
                'Please provide a valid email address',
            ],
        },
        password: {
            type: String,
            required: [true, 'Password is required'],
            minlength: [8, 'Password must be at least 8 characters long'],
            // select: false,
        },
        firstName: {
            type: String,
            required: [true, 'First name is required'],
            trim: true,
        },
        lastName: {
            type: String,
            required: [true, 'Last name is required'],
            trim: true,
        },
        role: {
            type: String,
            enum: {
                values: ['admin', 'superadmin'],
                message: '{VALUE} is not a valid role',
            },
            default: 'admin',
            required: true,
        },
        status: {
            type: String,
            enum: {
                values: ['pending', 'active', 'suspended'],
                message: '{VALUE} is not a valid status',
            },
            default: 'pending',
            required: true,
        },
        invitedBy: {
            type: Schema.Types.ObjectId,
            ref: 'AdminUser',
        },
        inviteToken: {
            type: String,
            select: false,
        },
        inviteTokenExpiry: {
            type: Date,
            select: false,
        },
        passwordResetToken: {
            type: String,
            select: false,
        },
        passwordResetExpiry: {
            type: Date,
            select: false,
        },
        lastLogin: {
            type: Date,
        },
    },
    {
        timestamps: true,
    }
);

// Indexes for better query performance
// adminUserSchema.index({ email: 1 });
// adminUserSchema.index({ status: 1 });
// adminUserSchema.index({ role: 1 });

adminUserSchema.pre('save', async function () {
    if (!this.isModified('password')) {
        return;
    }

    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
});

// Instance method to compare passwords
adminUserSchema.methods.comparePassword = async function (
    candidatePassword: string
): Promise<boolean> {
    return await bcrypt.compare(candidatePassword, this.password);
};

// Instance method to get full name
adminUserSchema.methods.getFullName = function (): string {
    return `${this.firstName} ${this.lastName}`;
};

// Static method to find active admins
adminUserSchema.statics.findActiveAdmins = function () {
    return this.find({ status: 'active' });
};

// Static method to find by email (including password)
adminUserSchema.statics.findByEmailWithPassword = function (email: string) {
    return this.findOne({ email }).select('+password');
};

// Virtual for full name (alternative to instance method)
adminUserSchema.virtual('fullName').get(function () {
    return `${this.firstName} ${this.lastName}`;
});

// Ensure virtuals are included in JSON output
adminUserSchema.set('toJSON', {
    virtuals: true,
    transform: function (_doc, ret) {
        // Remove sensitive fields from JSON output
        delete (ret as any).password;
        delete (ret as any).inviteToken;
        delete (ret as any).inviteTokenExpiry;
        delete (ret as any).__v;
        return ret;
    },
});

adminUserSchema.set('toObject', {
    virtuals: true,
});

// Define static methods interface
interface IAdminUserModel extends Model<IAdminUser> {
    findActiveAdmins(): Promise<IAdminUser[]>;
    findByEmailWithPassword(email: string): Promise<IAdminUser | null>;
}

// Create and export the model
const AdminUser = mongoose.model<IAdminUser, IAdminUserModel>(
    'AdminUser',
    adminUserSchema, 'AdminUser'
);

export default AdminUser;