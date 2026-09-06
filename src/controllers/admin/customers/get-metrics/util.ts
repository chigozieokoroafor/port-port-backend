import { prisma } from "../../../../config/database";

export const getCustomerMetricsAction = async () => {
    // Run parallel queries to count customers by status
    const [allCount, activeCount, inactiveCount] = await Promise.all([
        prisma.user.count({
            where: { role: "Customer" }
        }),
        prisma.user.count({
            where: { 
                role: "Customer",
                status: {
                    in: ["Active", "active"]
                }
            }
        }),
        prisma.user.count({
            where: { 
                role: "Customer",
                status: {
                    in: ["Inactive", "inactive", "Pending", "pending", "Blocked", "blocked"]
                }
            }
        })
    ]);

    return {
        all: allCount,
        active: activeCount,
        inactive: inactiveCount
    };
};
