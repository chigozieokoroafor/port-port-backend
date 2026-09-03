import { prisma } from "../../../config/database";

export const getQuoteRequestAction = async (id: string, userId: string) => {
    const quoteRequest = await prisma.quoteRequest.findFirst({
        where: {
            id,
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
        }
    });

    return quoteRequest;
};
