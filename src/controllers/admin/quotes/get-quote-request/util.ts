import { prisma } from "../../../../config/database";

export const getQuoteRequestAdminAction = async (id: string) => {
    const quoteRequest = await prisma.quoteRequest.findUnique({
        where: { id },
        include: {
            user: {
                select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                    email: true
                }
            },
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
