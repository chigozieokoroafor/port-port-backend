import { prisma } from "../../../../config/database";
import { object, string, number, type ObjectSchema } from "yup";

export const ListAdminShipmentsDTO = object({
    page: number().default(1),
    limit: number().default(10),
    status: string().optional(),
    search: string().optional()
});

export type TListAdminShipmentsDTO = typeof ListAdminShipmentsDTO.__outputType;

export async function validateDTO<T>(dto: any, schema: ObjectSchema<any>) {
    const validatedDTO = await schema.validate(dto, { abortEarly: false, stripUnknown: true });
    return validatedDTO;
}

export const getListAdminShipmentsAction = async (dto: TListAdminShipmentsDTO) => {
    const where: any = {};

    if (dto.status) {
        where.status = dto.status;
    }

    if (dto.search) {
        where.OR = [
            { sku: { contains: dto.search, mode: 'insensitive' } },
            {
                quote: {
                    quoteRequest: {
                        customer: {
                            is: {
                                fullName: { contains: dto.search, mode: 'insensitive' }
                            }
                        }
                    }
                }
            },
            {
                quote: {
                    quoteRequest: {
                        vehicle: {
                            is: {
                                make: { contains: dto.search, mode: 'insensitive' }
                            }
                        }
                    }
                }
            }
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
                            customer: true,
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
        const customer = shipment.quote?.quoteRequest?.customer;
        const vehicle = shipment.quote?.quoteRequest?.vehicle;
        const route = shipment.quote?.quoteRequest?.route;

        return {
            id: shipment.id,
            shipmentId: shipment.sku || 'N/A',
            customerName: customer?.fullName || 'N/A',
            vehicle: vehicle ? `${vehicle.make} ${vehicle.model} ${vehicle.year}` : 'N/A',
            route: route ? `${route.originPort}, ${route.originCountry} -> ${route.destinationPort}, ${route.destinationCountry}` : 'N/A',
            status: shipment.status
        };
    });

    return {
        shipments: formattedShipments,
        meta: shipments[1]
    };
};
