import { object, string, type ObjectSchema } from "yup";
import { prisma } from "../../../../config/database";
import { ApiError } from "../../../../utils/ApiError";
import { logActivity } from "../../../../services/activity/service";

const ALLOWED_STATUSES = ["Approved", "Rejected", "Pending"] as const;

export const UpdateDocumentStatusDTO = object({
    status: string()
        .trim()
        .required("Status is required")
        .transform((val) => {
            if (!val) return val;
            const lower = val.toLowerCase();
            if (lower === "approved") return "Approved";
            if (lower === "rejected") return "Rejected";
            if (lower === "pending") return "Pending";
            return val;
        })
        .oneOf(ALLOWED_STATUSES, "Status must be Approved, Rejected, or Pending"),
    reason: string()
        .trim()
        .when("status", {
            is: "Rejected",
            then: (schema) => schema.required("Rejection reason is required when rejecting a document"),
            otherwise: (schema) => schema.optional()
        })
});

export type TUpdateDocumentStatusDTO = typeof UpdateDocumentStatusDTO.__outputType;

export async function validateDTO<T>(dto: any, schema: ObjectSchema<any>) {
    const validatedDTO = await schema.validate(dto, { abortEarly: false, stripUnknown: true });
    return validatedDTO;
}

export const updateDocumentStatusAction = async (
    documentId: string,
    dto: TUpdateDocumentStatusDTO,
    adminId?: string
) => {
    if (!/^[0-9a-fA-F]{24}$/.test(documentId)) {
        throw new ApiError(400, "Invalid document ID");
    }

    const existingDocument = await prisma.documents.findUnique({
        where: { id: documentId },
        select: { id: true }
    });

    if (!existingDocument) {
        throw new ApiError(404, "Document not found");
    }

    if (dto.status === "Rejected") {
        await prisma.documentRejectReason.upsert({
            where: { documentId },
            create: {
                documentId,
                reason: dto.reason as string,
                ...(adminId ? { rejectedById: adminId } : {})
            },
            update: {
                reason: dto.reason as string,
                ...(adminId ? { rejectedById: adminId } : {})
            }
        });
    } else {
        // Clear any existing rejection reason if the document is Approved or reset to Pending
        await prisma.documentRejectReason.deleteMany({
            where: { documentId }
        });
    }

    const updatedDocument = await prisma.documents.update({
        where: { id: documentId },
        data: {
            status: dto.status
        },
        select: {
            id: true,
            name: true,
            url: true,
            status: true,
            userId: true,
            shipmentId: true,
            updatedAt: true,
            rejectReason: {
                select: {
                    id: true,
                    reason: true,
                    rejectedById: true,
                    createdAt: true,
                    updatedAt: true
                }
            }
        }
    });

    await logActivity({
        type: 'DOCUMENT_REVIEWED',
        message: `Document "${updatedDocument.name}" marked as ${updatedDocument.status}`,
        entityType: 'Document',
        entityId: updatedDocument.id,
        actorId: adminId,
        metadata: { status: updatedDocument.status }
    });

    return {
        ...updatedDocument,
        rejectReason: updatedDocument.rejectReason?.reason ?? null,
        rejectReasonDetails: updatedDocument.rejectReason ?? null
    };
};
