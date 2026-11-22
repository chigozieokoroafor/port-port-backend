import { prisma } from "../../../../config/database";
import { object, string, number, type ObjectSchema } from "yup";

export const ListAdminDocumentsDTO = object({
    page: number().default(1),
    limit: number().default(10),
    status: string().trim().optional(),
    search: string().trim().optional()
});

export type TListAdminDocumentsDTO = typeof ListAdminDocumentsDTO.__outputType;

export async function validateDTO<T>(dto: any, schema: ObjectSchema<any>) {
    const validatedDTO = await schema.validate(dto, { abortEarly: false, stripUnknown: true });
    return validatedDTO;
}

export const getListAdminDocumentsAction = async (dto: TListAdminDocumentsDTO) => {
    const where: any = {};

    if (dto.status) {
        where.status = { equals: dto.status, mode: 'insensitive' };
    }

    if (dto.search) {
        where.OR = [
            { name: { contains: dto.search, mode: 'insensitive' } },
            { user: { is: { firstName: { contains: dto.search, mode: 'insensitive' } } } },
            { user: { is: { lastName: { contains: dto.search, mode: 'insensitive' } } } },
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
            user: {
                select: {
                    id: true,
                    firstName: true,
                    lastName: true
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
        documentName: document.name,
        customerName: document.user
            ? `${document.user.firstName} ${document.user.lastName}`.trim()
            : 'N/A',
        shipmentId: document.shipment?.sku ?? null,
        uploadDate: document.createdAt,
        status: document.status,
        rejectReason: document.rejectReason?.reason ?? null,
        url: document.url
    }));

    return {
        documents: formattedDocuments,
        meta: documents[1]
    };
};
