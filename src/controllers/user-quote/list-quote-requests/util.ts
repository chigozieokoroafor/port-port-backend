import { prisma } from "../../../config/database";
import { object, string, number, type ObjectSchema } from "yup";

export const ListUserQuoteRequestsDTO = object({
    page: number().default(1),
    limit: number().default(10)
});

export type TListUserQuoteRequestsDTO = typeof ListUserQuoteRequestsDTO.__outputType;

export async function validateDTO<T>(dto: any, schema: ObjectSchema<any>) {
    const validatedDTO = await schema.validate(dto, { abortEarly: false, stripUnknown: true });
    return validatedDTO;
}

export const getUserQuoteRequestsAction = async (userId: string, dto: TListUserQuoteRequestsDTO) => {
    const quoteRequests = await prisma.quoteRequest.paginate({
        where: {
            userId
        },
        include: {
            quotes: {
                omit: {
                    generatedById: true,
                    createdById: true,
                    updatedById: true
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

    return {
        quoteRequests: quoteRequests[0],
        meta: quoteRequests[1]
    };
};
