import { prisma } from "../../../../config/database";

export const getAdminDashboardMetricsAction = async () => {
    const [
        newQuoteRequests,
        activeShipments,
        pendingDocuments,
        failedPayments
    ] = await Promise.all([
        prisma.quoteRequest.count({
            where: {
                status: {
                    in: ["Pending", "pending"]
                }
            }
        }),
        prisma.shipment.count({
            where: {
                status: {
                    notIn: ["Completed", "Delayed", "completed", "delayed"]
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
        prisma.payment.count({
            where: {
                status: {
                    in: ["Failed", "failed"]
                }
            }
        })
    ]);

    return {
        newQuoteRequests,
        activeShipments,
        pendingDocuments,
        failedPayments
    };
};
