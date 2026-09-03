import { prisma } from "../../../../config/database";

export const getShipmentMetricsAction = async () => {
    // We run parallel aggregations for the counts
    const [allCount, activeCount, completedCount, delayedCount] = await Promise.all([
        prisma.shipment.count(),
        prisma.shipment.count({
            where: {
                status: {
                    notIn: ["Completed", "Delayed", "completed", "delayed"]
                }
            }
        }),
        prisma.shipment.count({
            where: {
                status: {
                    in: ["Completed", "completed"]
                }
            }
        }),
        prisma.shipment.count({
            where: {
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
