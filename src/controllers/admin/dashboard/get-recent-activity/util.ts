import { object, string, number, type ObjectSchema } from "yup";
import { prisma } from "../../../../config/database";

export const ListRecentActivityDTO = object({
    page: number().default(1),
    limit: number().default(10),
    type: string().trim().optional()
});

export type TListRecentActivityDTO = typeof ListRecentActivityDTO.__outputType;

export async function validateDTO<T>(dto: any, schema: ObjectSchema<any>) {
    const validatedDTO = await schema.validate(dto, { abortEarly: false, stripUnknown: true });
    return validatedDTO;
}

export const getAdminRecentActivityAction = async (dto: TListRecentActivityDTO) => {
    const where: any = {};

    if (dto.type) {
        where.type = { equals: dto.type, mode: "insensitive" };
    }

    const logs = await prisma.activityLog.paginate({
        where,
        select: {
            id: true,
            type: true,
            message: true,
            entityType: true,
            entityId: true,
            metadata: true,
            createdAt: true,
            actor: {
                select: {
                    id: true,
                    firstName: true,
                    lastName: true
                }
            }
        },
        orderBy: {
            createdAt: "desc"
        }
    }).withPages({
        page: dto.page,
        limit: dto.limit,
        includePageCount: true
    });

    const formattedActivities = logs[0].map((log) => ({
        id: log.id,
        type: log.type,
        message: log.message,
        entityType: log.entityType,
        entityId: log.entityId,
        actor: log.actor
            ? {
                  id: log.actor.id,
                  name: `${log.actor.firstName} ${log.actor.lastName}`.trim()
              }
            : null,
        metadata: log.metadata ?? null,
        createdAt: log.createdAt
    }));

    return {
        activities: formattedActivities,
        meta: logs[1]
    };
};
