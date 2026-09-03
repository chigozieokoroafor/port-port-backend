import { prisma } from "../../../../config/database";

export const getPaymentMetricsAction = async () => {
    // 1. Total Received (Paid or Success)
    const totalReceivedAgg = await prisma.payment.aggregate({
        _sum: {
            amountPaid: true,
            expectedAmount: true, // fallback if amountPaid is empty
        },
        where: {
            status: {
                in: ["Paid", "paid", "Success", "success"]
            }
        }
    });

    const totalReceived = totalReceivedAgg._sum.amountPaid || totalReceivedAgg._sum.expectedAmount || 0;

    // 2. Pending Payments (Unpaid or Pending)
    const pendingPaymentsAgg = await prisma.payment.aggregate({
        _sum: {
            expectedAmount: true,
        },
        where: {
            status: {
                in: ["Unpaid", "unpaid", "Pending", "pending"]
            }
        }
    });
    
    const pendingPayments = pendingPaymentsAgg._sum.expectedAmount || 0;

    // 3. Failed Payments
    const failedPaymentsAgg = await prisma.payment.aggregate({
        _sum: {
            expectedAmount: true,
        },
        where: {
            status: {
                in: ["Failed", "failed"]
            }
        }
    });
    
    const failedPayments = failedPaymentsAgg._sum.expectedAmount || 0;

    return {
        totalReceived,
        pendingPayments,
        failedPayments
    };
};
