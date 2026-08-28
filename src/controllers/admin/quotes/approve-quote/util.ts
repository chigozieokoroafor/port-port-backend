import { prisma } from '../../../../config/database';
import { object, string, number, type ObjectSchema } from "yup";
import { ApiError } from '../../../../utils/ApiError';
import { generateReferenceId } from '../../../../utils/helper';
import { sendQuoteEmailToCustomer } from '../../../../services/email/service';

export const ApproveQuoteDTO = object({
    requestId: string().required(),
    shippingCost: number().required(),
    insurance: number().optional().default(0),
    handlingFees: number().optional().default(0),
    customsAndDocumentation: number().optional().default(0),
    notes: string().optional(),
});

export type TApproveQuoteDTO = typeof ApproveQuoteDTO.__outputType;

export async function validateDTO<T>(dto: any, schema: ObjectSchema<any>) {
    const validatedDTO = await schema.validate(dto, { abortEarly: false, stripUnknown: true });
    return validatedDTO;
}

export async function approveQuoteAction(dto: TApproveQuoteDTO, userId: string) {
    const request = await prisma.quoteRequest.findUnique({
        where: { id: dto.requestId }
    });

    if (!request) {
        throw new ApiError(404, 'Quote request not found');
    }

    // Update QuoteRequest status to Approved
    await prisma.quoteRequest.update({
        where: { id: dto.requestId },
        data: { status: "Approved" }
    });

    // Check if quote already exists
    let quote = await prisma.quote.findUnique({
        where: { quoteRequestId: dto.requestId }
    });

    const totalAmount = dto.shippingCost + 
                        dto.insurance + 
                        dto.handlingFees + 
                        dto.customsAndDocumentation;

    const pricing = {
        shippingCost: dto.shippingCost,
        insuranceCost: dto.insurance,
        handlingFees: dto.handlingFees,
        additionalCharges: [
            {
                description: "Customs & Documentation",
                amount: dto.customsAndDocumentation
            }
        ],
        totalAmount,
        currency: "USD"
    };

    if (quote) {
        quote = await prisma.quote.update({
            where: { quoteRequestId: dto.requestId },
            data: {
                pricing,
                notes: dto.notes ?? quote.notes,
                status: "Pending",
                generatedById: userId
            }
        });
    } else {
        const quoteNumber = generateReferenceId('QT');
        
        // Setup 30 days validity for Terms
        const validUntil = new Date();
        validUntil.setDate(validUntil.getDate() + 30);

        quote = await prisma.quote.create({
            data: {
                quoteNumber,
                quoteRequestId: dto.requestId,
                pricing,
                terms: {
                    validUntil,
                    paymentTerms: "Due on receipt"
                },
                notes: dto.notes,
                status: "Pending",
                generatedById: userId,
            }
        });
    }

    // Send quote mail
    await sendQuoteEmailToCustomer(
        request.customer.email, 
        quote.id, 
        quote.quoteNumber,
        request.id, 
        request.customer.fullName
    );

    return quote;
}
