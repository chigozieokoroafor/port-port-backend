import mongoose, { Document, Schema } from 'mongoose';

export interface ITokenBlacklist extends Document {
  token: string;
  userId: mongoose.Types.ObjectId;
  expiresAt: Date;
  createdAt: Date;
}

const tokenBlacklistSchema = new Schema<ITokenBlacklist>(
  {
    token: {
      type: String,
      required: true,
      unique: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'AdminUser',
      required: true,
    },
    expiresAt: {
      type: Date,
      required: true,
      index: { expires: 0 },
    },
  },
  {
    timestamps: true,
  }
);

// Index for faster lookups
tokenBlacklistSchema.index({ token: 1 });

const TokenBlacklist = mongoose.model<ITokenBlacklist>(
  'TokenBlacklist',
  tokenBlacklistSchema
);

export default TokenBlacklist;
