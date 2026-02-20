import mongoose, { Document, Schema } from 'mongoose';

export interface IQuote extends Document {
    quoteNumber: string;
    quoteRequestId: mongoose.Types.ObjectId;
    
    pricing: {
        shippingCost: number;
        insuranceCost?: number;
        handlingFees?: number;
        additionalCharges?: {
        description: string;
        amount: number;
        }[];
        totalAmount: number;
        currency: string;
    };
    
    terms: {
        validUntil: Date;
        paymentTerms: string;
        specialConditions?: string;
    };
    
    status: 'draft' | 'sent' | 'viewed' | 'accepted' | 'expired' | 'rejected';
    
    sentAt?: Date;
    viewedAt?: Date;
    
    generatedBy: mongoose.Types.ObjectId;
    
    createdAt: Date;
    updatedAt: Date;
}

const quoteSchema = new Schema<IQuote>(
    {
        quoteNumber: {
            type: String,
            required: true,
            unique: true,
            index: true,
        },
        quoteRequestId: {
            type: Schema.Types.ObjectId,
            ref: 'QuoteRequest',
            required: true,
            index: true,
        },
        pricing: {
            shippingCost: {
                type: Number,
                required: [true, 'Shipping cost is required'],
                min: [0, 'Shipping cost must be positive'],
            },
            insuranceCost: {
                type: Number,
                min: [0, 'Insurance cost must be positive'],
            },
            handlingFees: {
                type: Number,
                min: [0, 'Handling fees must be positive'],
            },
            additionalCharges: [
                {
                description: {
                    type: String,
                    required: true,
                    trim: true,
                },
                amount: {
                    type: Number,
                    required: true,
                    min: [0, 'Amount must be positive'],
                },
                },
            ],
            totalAmount: {
                type: Number,
                required: [true, 'Total amount is required'],
                min: [0, 'Total amount must be positive'],
            },
            currency: {
                type: String,
                required: true,
                default: 'USD',
                uppercase: true,
            },
        },
        terms: {
            validUntil: {
                type: Date,
                required: [true, 'Quote validity date is required'],
            },
            paymentTerms: {
                type: String,
                required: [true, 'Payment terms are required'],
                trim: true,
            },
            specialConditions: {
                type: String,
                trim: true,
            },
        },
        status: {
            type: String,
            enum: ['draft', 'sent', 'viewed', 'accepted', 'expired', 'rejected'],
            default: 'draft',
        },
        sentAt: { type: Date, },
        viewedAt: { type: Date, },
        generatedBy: {
            type: Schema.Types.ObjectId,
            ref: 'AdminUser',
            required: true,
        },
    },
    {
        timestamps: true,
    }
    );

// Indexes
// quoteSchema.index({ quoteNumber: 1 });
// quoteSchema.index({ quoteRequestId: 1 });
// quoteSchema.index({ status: 1 });
// quoteSchema.index({ createdAt: -1 });

// Virtual to check if quote is expired
quoteSchema.virtual('isExpired').get(function () {
    return this.terms.validUntil < new Date();
});

// Ensure virtuals are included
quoteSchema.set('toJSON', { virtuals: true });
quoteSchema.set('toObject', { virtuals: true });

const Quote = mongoose.model<IQuote>('Quote', quoteSchema);

export default Quote;