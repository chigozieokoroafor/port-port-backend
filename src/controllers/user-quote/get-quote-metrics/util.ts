import { prisma } from "../../../config/database";

export const getUserQuoteMetricsAction = async (userId: string) => {
    const metrics = await prisma.quoteRequest.groupBy({
        by: ['status'],
        where: { userId },
        _count: {
            status: true
        }
    });

    let approved = 0;
    let pending = 0;
    let rejected = 0;

    for (const m of metrics) {
        if (m.status === 'Approved') approved = m._count.status;
        if (m.status === 'Pending') pending = m._count.status;
        if (m.status === 'Rejected') rejected = m._count.status;
    }

    const allQuotes = approved + pending + rejected;

    return {
        allQuotes,
        approvedQuotes: approved,
        pendingQuotes: pending,
        rejectedQuotes: rejected
    };
};
