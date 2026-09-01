import { prisma } from "../../../../config/database";

export const getAdminQuoteMetricsAction = async () => {
    // 1. All Quotes (Total quote requests)
    const allQuotesCount = await prisma.quoteRequest.count();

    // 2. Pending Quotes (status === "Pending")
    const pendingQuotesCount = await prisma.quoteRequest.count({
        where: { status: "Pending" }
    });

    // 3. Accepted Quotes (status === "Approved")
    const acceptedQuotesCount = await prisma.quoteRequest.count({
        where: { status: "Approved" }
    });

    // 4. New Quotes (created today & status === "Pending")
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const newQuotesCount = await prisma.quoteRequest.count({
        where: {
            status: "Pending",
            createdAt: {
                gte: today
            }
        }
    });

    return {
        newQuotes: newQuotesCount,
        allQuotes: allQuotesCount,
        acceptedQuotes: acceptedQuotesCount,
        pendingQuotes: pendingQuotesCount
    };
};
