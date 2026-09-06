import { prisma } from "../../../../config/database";
import { ApiError } from "../../../../utils/ApiError";

export const getCustomerProfileAction = async (customerId: string) => {
    const customer = await prisma.user.findUnique({
        where: { id: customerId }
    });

    if (!customer || customer.role !== "Customer") {
        throw new ApiError(404, 'Customer not found');
    }

    // Format the response to match the UI requirements (with nulls for non-existent fields)
    return {
        id: customer.id,
        status: customer.status,
        initials: `${customer.firstName.charAt(0)}${customer.lastName.charAt(0)}`.toUpperCase(),
        firstName: customer.firstName,
        lastName: customer.lastName,
        name: `${customer.firstName} ${customer.lastName}`,
        email: customer.email,
        phoneNumber: null, // To be implemented in schema
        company: null,     // To be implemented in schema
        customerSince: customer.createdAt
    };
};
