import { prisma } from "../../../../config/database";

export interface ActionRequiredItem {
    type: "quote_request" | "document" | "payment" | "ticket";
    message: string;
    entityId: string | null;
    reference: string | null;
    count: number;
    createdAt?: Date;
}

export const getAdminActionsRequiredAction = async () => {
    const [
        pendingQuotes,
        pendingDocuments,
        paymentsRequiringConfirmationCount,
        openTicketsCount
    ] = await Promise.all([
        prisma.quoteRequest.findMany({
            where: {
                status: {
                    in: ["Pending", "pending"]
                }
            },
            select: {
                id: true,
                referenceId: true,
                createdAt: true
            },
            orderBy: {
                createdAt: "desc"
            },
            take: 5
        }),
        prisma.documents.findMany({
            where: {
                status: {
                    in: ["Pending", "pending"]
                }
            },
            select: {
                id: true,
                name: true,
                createdAt: true,
                shipment: {
                    select: {
                        sku: true
                    }
                }
            },
            orderBy: {
                createdAt: "desc"
            },
            take: 5
        }),
        prisma.payment.count({
            where: {
                OR: [
                    { status: { in: ["Unpaid", "unpaid", "Failed", "failed", "Pending", "pending"] } },
                    { amountMismatch: true }
                ]
            }
        }),
        prisma.ticket.count({
            where: {
                status: {
                    in: ["Open", "open"]
                }
            }
        })
    ]);

    const actions: ActionRequiredItem[] = [];

    for (const qr of pendingQuotes) {
        actions.push({
            type: "quote_request",
            message: `Quote ${qr.referenceId} awaiting review`,
            entityId: qr.id,
            reference: qr.referenceId,
            count: 1,
            createdAt: qr.createdAt
        });
    }

    for (const doc of pendingDocuments) {
        const shipmentLabel = doc.shipment?.sku
            ? ` for shipment #${doc.shipment.sku}`
            : "";
        actions.push({
            type: "document",
            message: `Document pending approval${shipmentLabel}`,
            entityId: doc.id,
            reference: doc.shipment?.sku ?? null,
            count: 1,
            createdAt: doc.createdAt
        });
    }

    if (paymentsRequiringConfirmationCount > 0) {
        actions.push({
            type: "payment",
            message: `${paymentsRequiringConfirmationCount} ${
                paymentsRequiringConfirmationCount === 1 ? "payment requires" : "payments require"
            } confirmation`,
            entityId: null,
            reference: null,
            count: paymentsRequiringConfirmationCount
        });
    }

    if (openTicketsCount > 0) {
        actions.push({
            type: "ticket",
            message: `${openTicketsCount} support ${
                openTicketsCount === 1 ? "ticket" : "tickets"
            } awaiting response`,
            entityId: null,
            reference: null,
            count: openTicketsCount
        });
    }

    return actions;
};
