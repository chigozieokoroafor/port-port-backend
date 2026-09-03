import { prisma } from "../../../../config/database";
import { object, string, type ObjectSchema } from "yup";
import { ApiError } from "../../../../utils/ApiError";

export const CreateShipmentDTO = object({
    quoteRequestId: string().required('Quote Request ID is required')
});

export type TCreateShipmentDTO = typeof CreateShipmentDTO.__outputType;

export async function validateDTO<T>(dto: any, schema: ObjectSchema<any>) {
    const validatedDTO = await schema.validate(dto, { abortEarly: false, stripUnknown: true });
    return validatedDTO;
}

export const createShipmentAction = async (dto: TCreateShipmentDTO, adminId: string) => {
    // 1. Fetch QuoteRequest to ensure it exists and get userId
    const quoteRequest = await prisma.quoteRequest.findUnique({
        where: { id: dto.quoteRequestId }
    });

    if (!quoteRequest) {
        throw new ApiError(404, 'Quote request not found');
    }

    // 2. Fetch the Quote linked to this request
    const quote = await prisma.quote.findFirst({
        where: { quoteRequestId: dto.quoteRequestId }
    });

    if (!quote) {
        throw new ApiError(400, 'No quote found for this quote request');
    }

    // 3. Fetch the Payment linked to the quote
    const payment = await prisma.payment.findFirst({
        where: { quoteId: quote.id }
    });

    if (!payment) {
        throw new ApiError(400, 'No payment found for this quote');
    }

    // 4. Ensure a shipment doesn't already exist for this payment
    const existingShipment = await prisma.shipment.findUnique({
        where: { paymentId: payment.id }
    });

    if (existingShipment) {
        throw new ApiError(400, 'A shipment already exists for this payment');
    }

    // 5. Create Shipment
    const sku = `SKU-${new Date().getFullYear()}-${Math.floor(Math.random() * 1000000).toString().padStart(6, '0')}`;
    const shipment = await prisma.shipment.create({
        data: {
            sku,
            quoteId: quote.id,
            paymentId: payment.id,
            userId: quoteRequest.userId,
            updatedById: adminId,
            isManual: true,
            status: "Dock"
        }
    });

    return shipment;
};
