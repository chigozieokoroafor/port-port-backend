import { prisma } from "../../../config/database";
import { object, string, number, type ObjectSchema } from "yup";

export const ListAdminPaymentsDTO = object({
    page: number().default(1),
    limit: number().default(10),
    status: string().optional(),
    search: string().optional(),
    startDate: string().optional(),
    endDate: string().optional()
});

export type TListAdminPaymentsDTO = typeof ListAdminPaymentsDTO.__outputType;

export async function validateDTO<T>(dto: any, schema: ObjectSchema<any>) {
    const validatedDTO = await schema.validate(dto, { abortEarly: false, stripUnknown: true });
    return validatedDTO;
}

export const getListAdminPaymentsAction = async (dto: TListAdminPaymentsDTO) => {
    const where: any = {};

    if (dto.status) {
        where.status = dto.status;
    }

    if (dto.search) {
        where.OR = [
            { quoteReference: { contains: dto.search, mode: 'insensitive' } },
            // { id: { contains: dto.search, mode: 'insensitive' } },
            // { stripeSessionId: { contains: dto.search, mode: 'insensitive' } },
            // { stripePaymentIntentId: { contains: dto.search, mode: 'insensitive' } },
            {
                quote: {
                    quoteRequest: {
                        customer: {
                            is: {
                                fullName: { contains: dto.search, mode: 'insensitive' }
                            }
                        }
                    }
                }
            }
        ];
    }

    if (dto.startDate || dto.endDate) {
        where.createdAt = {};
        if (dto.startDate) where.createdAt.gte = new Date(dto.startDate);
        if (dto.endDate) where.createdAt.lte = new Date(dto.endDate);
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
            stripeSessionId: true,
            shipments: true,
            quote: {
                select: {
                    quoteRequest: {
                        select: {
                            customer: true
                        }
                    }
                }
            }
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
            customerName: payment.quote?.quoteRequest?.customer?.fullName || 'N/A',
            shipmentId: payment.shipments[0]?.sku || null,
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
