import { prisma } from "../../../config/database";
import { object, string, number, type ObjectSchema } from "yup";

export const ListUserPaymentsDTO = object({
    page: number().default(1),
    limit: number().default(10),
    status: string().optional(),
    search: string().optional()
});

export type TListUserPaymentsDTO = typeof ListUserPaymentsDTO.__outputType;

export async function validateDTO<T>(dto: any, schema: ObjectSchema<any>) {
    const validatedDTO = await schema.validate(dto, { abortEarly: false, stripUnknown: true });
    return validatedDTO;
}

export const getListUserPaymentsAction = async (userId: string, dto: TListUserPaymentsDTO) => {
    const where: any = {
        quote: {
            quoteRequest: {
                userId
            }
        }
    };

    if (dto.status) {
        where.status = dto.status;
    }

    if (dto.search) {
        where.OR = [
            { quoteReference: { contains: dto.search, mode: 'insensitive' } },
            { id: { contains: dto.search, mode: 'insensitive' } }
        ];
    }

    const payments = await prisma.payment.paginate({
        where,
        select: {
            id: true,
            quoteReference: true,
            createdAt: true,
            expectedAmount: true,
            amountPaid: true,
            expectedCurrency: true,
            currency: true,
            status: true,
            provider: true,
            stripeSessionId: true
        },
        orderBy: {
            createdAt: 'desc'
        }
    }).withPages({
        page: dto.page,
        limit: dto.limit
    });

    const formattedPayments = payments[0].map(payment => {
        return {
            id: payment.id,
            paymentId: payment.quoteReference || payment.id,
            shipmentId: null,
            date: payment.createdAt,
            amount: payment.expectedAmount || payment.amountPaid || 0,
            currency: payment.expectedCurrency || payment.currency || 'GBP',
            status: payment.status,
            receiptUrl: payment.provider === 'Stripe' && payment.stripeSessionId ? `/api/payment/receipt/${payment.id}` : null
        };
    });

    return {
        payments: formattedPayments,
        meta: payments[1]
    };
};
