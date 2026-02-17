import mongoose, { Document, Schema } from 'mongoose';

export interface IQuoteRequest extends Document {
    referenceId: string;
    
    customer: {
        fullName: string;
        email: string;
        phone: string;
        companyName?: string;
    };
    
    vehicle: {
        type: 'car' | 'suv' | 'truck' | 'machinery' | 'motorhome' | 'other';
        make: string;
        model: string;
        year: number;
        vin: string;
        dimensions: {
        length: number;
        width: number;
        height: number;
        };
        weight: number;
        condition: 'running' | 'non-running';
    };
    
    route: {
        originCountry: string;
        originPort: string;
        destinationCountry: string;
        destinationPort: string;
        preferredShippingDate?: Date;
    };
    
    status: 'new' | 'reviewed' | 'quoted' | 'paid' | 'in-transit' | 'delivered' | 'cancelled';
    notes?: string;
    
    createdAt: Date;
    updatedAt: Date;
}

const quoteRequestSchema = new Schema<IQuoteRequest>(
    {
        referenceId: {
            type: String,
            required: true,
            unique: true,
            index: true,
        },
        customer: {
            fullName: {
                type: String,
                required: [true, 'Customer full name is required'],
                trim: true,
            },
            email: {
                type: String,
                required: [true, 'Customer email is required'],
                trim: true,
                lowercase: true,
                match: [/^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/, 'Please provide a valid email'],
            },
            phone: {
                type: String,
                required: [true, 'Customer phone is required'],
                trim: true,
            },
            companyName: {
                type: String,
                trim: true,
            },
        },
        vehicle: {
            type: {
                type: String,
                enum: ['car', 'suv', 'truck', 'machinery', 'motorhome', 'other'],
                required: [true, 'Vehicle type is required'],
            },
            make: {
                type: String,
                required: [true, 'Vehicle make is required'],
                trim: true,
            },
            model: {
                type: String,
                required: [true, 'Vehicle model is required'],
                trim: true,
            },
            year: {
                type: Number,
                required: [true, 'Vehicle year is required'],
                min: [1900, 'Year must be 1900 or later'],
                max: [new Date().getFullYear() + 1, 'Year cannot be in the future'],
            },
            vin: {
                type: String,
                required: [true, 'VIN/Chassis number is required'],
                trim: true,
                uppercase: true,
            },
            dimensions: {
                length: {
                type: Number,
                required: [true, 'Vehicle length is required'],
                min: [0, 'Length must be positive'],
                },
                width: {
                type: Number,
                required: [true, 'Vehicle width is required'],
                min: [0, 'Width must be positive'],
                },
                height: {
                type: Number,
                required: [true, 'Vehicle height is required'],
                min: [0, 'Height must be positive'],
                },
            },
            weight: {
                type: Number,
                required: [true, 'Vehicle weight is required'],
                min: [0, 'Weight must be positive'],
            },
            condition: {
                type: String,
                enum: ['running', 'non-running'],
                required: [true, 'Vehicle condition is required'],
            },
        },
        route: {
            originCountry: {
                type: String,
                required: [true, 'Origin country is required'],
                trim: true,
            },
            originPort: {
                type: String,
                required: [true, 'Origin port is required'],
                trim: true,
            },
            destinationCountry: {
                type: String,
                required: [true, 'Destination country is required'],
                trim: true,
            },
            destinationPort: {
                type: String,
                required: [true, 'Destination port is required'],
                trim: true,
            },
            preferredShippingDate: {
                type: Date,
            },
        },
        status: {
            type: String,
            enum: ['new', 'reviewed', 'quoted', 'paid', 'in-transit', 'delivered', 'cancelled'],
            default: 'new',
        },
        notes: {
            type: String,
            trim: true,
        },
    },
    {
        timestamps: true,
    }
);

// Indexes
// quoteRequestSchema.index({ referenceId: 1 });
// quoteRequestSchema.index({ status: 1 });
// quoteRequestSchema.index({ 'customer.email': 1 });
// quoteRequestSchema.index({ createdAt: -1 });

const QuoteRequest = mongoose.model<IQuoteRequest>('QuoteRequest', quoteRequestSchema);

export default QuoteRequest;