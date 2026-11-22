import { prisma } from "../../config/database";
import logger from "../../utils/logger";

export interface LogActivityInput {
    type: string;
    message: string;
    entityType?: string;
    entityId?: string | null;
    actorId?: string | null;
    metadata?: Record<string, any>;
}

const isValidObjectId = (id?: string | null): id is string =>
    Boolean(id && /^[0-9a-fA-F]{24}$/.test(id));

/**
 * Non-blocking activity logger so audit trail failures never break primary requests.
 */
export const logActivity = async (input: LogActivityInput): Promise<void> => {
    try {
        await prisma.activityLog.create({
            data: {
                type: input.type,
                message: input.message,
                entityType: input.entityType ?? null,
                entityId: isValidObjectId(input.entityId) ? input.entityId : null,
                actorId: isValidObjectId(input.actorId) ? input.actorId : null,
                ...(input.metadata ? { metadata: input.metadata } : {})
            }
        });
    } catch (error) {
        logger.warn(`Failed to record activity log (${input.type}):`, error);
    }
};
