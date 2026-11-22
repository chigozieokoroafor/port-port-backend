import { prisma } from "../../../config/database";
import { object, string, number, type ObjectSchema } from "yup";

export const ListUserDocumentsDTO = object({
    page: number().default(1),
    limit: number().default(10),
    status: string().trim().optional(),
    search: string().trim().optional()
});

export type TListUserDocumentsDTO = typeof ListUserDocumentsDTO.__outputType;

export async function validateDTO<T>(dto: any, schema: ObjectSchema<any>) {
    const validatedDTO = await schema.validate(dto, { abortEarly: false, stripUnknown: true });
    return validatedDTO;
}

export const getListUserDocumentsAction = async (userId: string, dto: TListUserDocumentsDTO) => {
    const where: any = {
        userId
    };

    if (dto.status) {
        where.status = { equals: dto.status, mode: 'insensitive' };
    }

    // Search by document type (name) or shipment ID (sku)
    if (dto.search) {
        where.OR = [
            { name: { contains: dto.search, mode: 'insensitive' } },
            { shipment: { is: { sku: { contains: dto.search, mode: 'insensitive' } } } }
        ];
    }

    const documents = await prisma.documents.paginate({
        where,
        select: {
            id: true,
            name: true,
            url: true,
            status: true,
            createdAt: true,
            rejectReason: {
                select: {
                    reason: true
                }
            },
            shipment: {
                select: {
                    id: true,
                    sku: true
                }
            }
        },
        orderBy: {
            createdAt: 'desc'
        }
    }).withPages({
        page: dto.page,
        limit: dto.limit,
        includePageCount: true
    });

    const formattedDocuments = documents[0].map(document => ({
        id: document.id,
        type: document.name,
        shipmentId: document.shipment?.sku ?? null,
        uploadDate: document.createdAt,
        status: document.status,
        rejectReason: document.rejectReason?.reason ?? null,
        downloadUrl: document.url
    }));

    return {
        documents: formattedDocuments,
        meta: documents[1]
    };
};
