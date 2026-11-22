import { prisma } from "../../../../config/database";

export const getAdminDocumentMetricsAction = async () => {
    const [allCount, approvedCount, pendingCount, rejectedCount] = await Promise.all([
        prisma.documents.count(),
        prisma.documents.count({
            where: {
                status: {
                    in: ["Approved", "approved"]
                }
            }
        }),
        prisma.documents.count({
            where: {
                status: {
                    in: ["Pending", "pending"]
                }
            }
        }),
        prisma.documents.count({
            where: {
                status: {
                    in: ["Rejected", "rejected"]
                }
            }
        })
    ]);

    return {
        all: allCount,
        approved: approvedCount,
        pending: pendingCount,
        rejected: rejectedCount
    };
};
