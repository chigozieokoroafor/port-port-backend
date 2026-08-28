import { prisma } from '../../../../config/database';
import { Prisma } from '../../../../../generated/prisma'; // Or adjust based on correct path
import { object, string, number, type ObjectSchema } from "yup";

export const ListQuotesDTO = object(
    {
        page: number().default(1),
        limit: number().default(10),
        search: string().optional(),
    }
)

export type TListQuotesDTO = typeof ListQuotesDTO.__outputType;

export async function validateDTO<T>(dto: any, schema: ObjectSchema<any>) {

    const validatedDTO = await schema.validate(dto, { abortEarly: false, stripUnknown: true });
    return validatedDTO;

}

export async function getQuotesList(
    dto: TListQuotesDTO
) {
    const where: any = {};

    if (status) {
        where.status = status;
    }

    if (dto.search) {
        where.OR = [
            { referenceId: { contains: dto.search, mode: 'insensitive' } },
            {
                customer: {
                    is: {
                        fullName: { contains: dto.search, mode: 'insensitive' }
                    }
                }
            },
            {
                vehicle: {
                    is: {
                        make: { contains: dto.search, mode: 'insensitive' }
                    }
                }
            },
            {
                vehicle: {
                    is: {
                        model: { contains: dto.search, mode: 'insensitive' }
                    }
                }
            }
        ];
    }

    const result = await prisma.quoteRequest.paginate({
        where,
        // include: {
        //     quotes: true
        // },
        orderBy: { createdAt: 'desc' }
    }).withPages(
        {
            page: dto.page,
            limit: dto.limit
        }
    )

    return result

};

export function getQuoteListDAO(data: Awaited<ReturnType<typeof getQuotesList>>) {
    return {
        quoteRequests: data[0].map(i => {
            return {
                referenceId: i.referenceId,
                customerName: i.customer.fullName,
                vehicle: `${i.vehicle.make} ${i.vehicle.model} ${i.vehicle.year}`,
                route: `${i.route.originCountry} -> ${i.route.destinationCountry}`,
                status: i.status,
            }
        }),
        meta: data[1]
    };
}
