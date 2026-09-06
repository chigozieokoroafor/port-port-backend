import { prisma } from "../../../config/database";

export const getUserShipmentMetricsAction = async (userId: string) => {
    // We run parallel aggregations for the counts, filtering by userId
    const [allCount, activeCount, completedCount, delayedCount] = await Promise.all([
        prisma.shipment.count({
            where: { userId }
        }),
        prisma.shipment.count({
            where: {
                userId,
                status: {
                    notIn: ["Completed", "Delayed", "completed", "delayed"]
                }
            }
        }),
        prisma.shipment.count({
            where: {
                userId,
                status: {
                    in: ["Completed", "completed"]
                }
            }
        }),
        prisma.shipment.count({
            where: {
                userId,
                status: {
                    in: ["Delayed", "delayed"]
                }
            }
        })
    ]);

    return {
        all: allCount,
        active: activeCount,
        completed: completedCount,
        delayed: delayedCount
    };
};
