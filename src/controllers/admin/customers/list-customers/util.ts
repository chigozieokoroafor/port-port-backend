import { prisma } from "../../../../config/database";

interface ListCustomersDto {
    page: number;
    limit: number;
    search?: string;
    status?: string;
}

export const listCustomersAction = async (dto: ListCustomersDto) => {
    let where: any = {
        role: "Customer" // Only fetch users with role 'Customer'
    };

    if (dto.search) {
        where.OR = [
            { firstName: { contains: dto.search, mode: 'insensitive' } },
            { lastName: { contains: dto.search, mode: 'insensitive' } },
            { email: { contains: dto.search, mode: 'insensitive' } },
            // Search by ID is harder since it's ObjectId in mongo, but we can try exact match if it looks like one, or just rely on name/email
        ];
    }

    if (dto.status) {
        where.status = dto.status;
    }

    const customers = await prisma.user.paginate({
        where,
        select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            status: true,
            _count: {
                select: {
                    shipments: true
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

    const formattedCustomers = customers[0].map(customer => {
        return {
            customerId: customer.id,
            customerName: `${customer.firstName} ${customer.lastName}`.trim(),
            emailAddress: customer.email,
            numberOfShipments: customer._count.shipments,
            status: customer.status,
            action: 'View Details' // typically static on frontend, but good for completeness if requested
        };
    });

    return {
        customers: formattedCustomers,
        meta: customers[1]
    };
};
