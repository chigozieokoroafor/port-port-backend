import { prisma } from "../../../config/database";
import { object, string, number, type ObjectSchema } from "yup";

export const ListUserShipmentsDTO = object({
    page: number().default(1),
    limit: number().default(10),
    status: string().optional(),
    search: string().optional()
});

export type TListUserShipmentsDTO = typeof ListUserShipmentsDTO.__outputType;

export async function validateDTO<T>(dto: any, schema: ObjectSchema<any>) {
    const validatedDTO = await schema.validate(dto, { abortEarly: false, stripUnknown: true });
    return validatedDTO;
}

export const getListUserShipmentsAction = async (userId: string, dto: TListUserShipmentsDTO) => {
    const where: any = {
        userId
    };

    if (dto.status) {
        where.status = dto.status;
    }

    if (dto.search) {
        where.OR = [
            { sku: { contains: dto.search, mode: 'insensitive' } },
            // Add more search fields if needed
        ];
    }

    const shipments = await prisma.shipment.paginate({
        where,
        select: {
            id: true,
            sku: true,
            status: true,
            createdAt: true,
            quote: {
                select: {
                    quoteRequest: {
                        select: {
                            vehicle: true,
                            route: true
                        }
                    }
                }
            }
        },
        orderBy: {
            createdAt: 'desc'
        }
    }).withPages({
        page: dto.page,
        limit: dto.limit
    });

    const formattedShipments = shipments[0].map(shipment => {
        const vehicle = shipment.quote?.quoteRequest?.vehicle;
        const route = shipment.quote?.quoteRequest?.route;

        return {
            id: shipment.id,
            shipmentId: shipment.sku,//`SHP-${new Date(shipment.createdAt).getFullYear()}-${shipment.id.substring(shipment.id.length - 4).toUpperCase()}`, // Mocking a readable ID similar to the UI screenshot
            vehicle: vehicle ? `${vehicle.make} ${vehicle.model} ${vehicle.year}` : 'N/A',
            route: route ? `${route.originPort}, ${route.originCountry} -> ${route.destinationPort}, ${route.destinationCountry}` : 'N/A',
            status: shipment.status,
            estimatedArrival: null // Update this if an estimated arrival date is added to the schema in the future
        };
    });

    return {
        shipments: formattedShipments,
        meta: shipments[1]
    };
};
