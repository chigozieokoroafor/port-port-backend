import mongoose, { Document, Schema, Model } from 'mongoose';
import bcrypt from 'bcryptjs';
// import { IAdminUser } from './AdminUser.model';
import { UserStatus } from './enums/UserStatus.enum';
import { UserType } from './enums/UserType.enum';

export interface IUser extends Document {
    email: string;
    password: string;
    tempPassword:string;
    firstName: string;
    lastName: string;
    role: UserType;
    status: UserStatus;
    invitedBy?: mongoose.Types.ObjectId;
    inviteToken?: string;
    inviteTokenExpiry?: Date;
    passwordResetToken?: string;
    passwordResetExpiry?: Date;
    lastLogin?: Date;
    createdAt: Date;
    updatedAt: Date;
    isSubscribedToNewsletter: boolean;
    isAgreedToTermsAndConditions: boolean;
    
    comparePassword(candidatePassword: string): Promise<boolean>;
    getFullName(): string;
}

// Mongoose schema
const userSchema = new Schema<IUser>(
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
                values: [UserType.Admin, UserType.Customer, UserType.SuperAdmin],
                message: '{VALUE} is not a valid role',
            },
            default: UserType.Customer,
            required: true,
        },
        status: {
            type: String,
            enum: {
                values: [UserStatus.Pending, UserStatus.Active, UserStatus.Suspended],
                message: '{VALUE} is not a valid status',
            },
            default: UserStatus.Pending,
            required: true,
        },
        invitedBy: {
            type: Schema.Types.ObjectId,
            ref: 'User',
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
        isSubscribedToNewsletter:{
            type: Boolean,
            default: false
        },
        isAgreedToTermsAndConditions:{
            type: Boolean,
            default: false
        }
    },
    {
        timestamps: true,
    }
);

// Indexes for better query performance
// userSchema.index({ email: 1 });
// userSchema.index({ status: 1 });
// userSchema.index({ role: 1 });

userSchema.pre('save', async function () {
    if (!this.isModified('password')) {
        return;
    }

    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
});

// Instance method to compare passwords
userSchema.methods.comparePassword = async function (
    candidatePassword: string
): Promise<boolean> {
    return await bcrypt.compare(candidatePassword, this.password);
};

// Instance method to get full name
userSchema.methods.getFullName = function (): string {
    return `${this.firstName} ${this.lastName}`;
};

// Static method to find active admins
userSchema.statics.findActiveAdmins = function () {
    return this.find({ status: 'active' });
};

// Static method to find by email (including password)
userSchema.statics.findByEmailWithPassword = function (email: string) {
    return this.findOne({ email }).select('+password');
};

// Virtual for full name (alternative to instance method)
userSchema.virtual('fullName').get(function () {
    return `${this.firstName} ${this.lastName}`;
});

// Ensure virtuals are included in JSON output
userSchema.set('toJSON', {
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

userSchema.set('toObject', {
    virtuals: true,
});

// Define static methods interface
interface IUserModel extends Model<IUser> {
    findActiveAdmins(): Promise<IUser[]>;
    findByEmailWithPassword(email: string): Promise<IUser | null>;
}

// Create and export the model
const User = mongoose.model<IUser, IUserModel>(
    'User',
    userSchema, 'User'
);

export default User;