import path from "path";
import { prisma } from "../../../../config/database";
import { ApiError } from "../../../../utils/ApiError";

const formatBytes = (bytes?: number | null): string | null => {
    if (bytes === undefined || bytes === null) return null;
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    const value = parseFloat((bytes / Math.pow(k, i)).toFixed(1));
    return `${value} ${sizes[i]}`;
};

const getFileFormat = (mimeType?: string | null, url?: string): string | null => {
    if (mimeType) {
        const subtype = mimeType.split("/")[1];
        if (subtype) {
            if (subtype.toLowerCase() === "jpeg") return "JPG";
            return subtype.toUpperCase();
        }
    }
    if (url) {
        const ext = path.extname(url.split("?")[0]).replace(".", "");
        if (ext) return ext.toUpperCase();
    }
    return null;
};

export const getAdminDocumentByIdAction = async (documentId: string) => {
    if (!/^[0-9a-fA-F]{24}$/.test(documentId)) {
        throw new ApiError(400, "Invalid document ID");
    }

    const document = await prisma.documents.findUnique({
        where: { id: documentId },
        select: {
            id: true,
            name: true,
            url: true,
            mimeType: true,
            fileSize: true,
            status: true,
            createdAt: true,
            updatedAt: true,
            rejectReason: {
                select: {
                    id: true,
                    reason: true,
                    rejectedById: true,
                    createdAt: true,
                    updatedAt: true
                }
            },
            user: {
                select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                    email: true
                }
            },
            shipment: {
                select: {
                    id: true,
                    sku: true,
                    status: true,
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
                }
            }
        }
    });

    if (!document) {
        throw new ApiError(404, "Document not found");
    }

    const quoteRequest = document.shipment?.quote?.quoteRequest;
    const vehicle = quoteRequest?.vehicle;
    const route = quoteRequest?.route;

    const customerName = document.user
        ? `${document.user.firstName} ${document.user.lastName}`.trim()
        : quoteRequest?.customer?.fullName || "N/A";

    return {
        id: document.id,
        documentCode: `DOC-${document.id.slice(-4).toUpperCase()}`,
        documentType: document.name,
        url: document.url,
        downloadUrl: document.url,
        mimeType: document.mimeType,
        fileFormat: getFileFormat(document.mimeType, document.url),
        fileSize: document.fileSize,
        fileSizeFormatted: formatBytes(document.fileSize),
        status: document.status,
        rejectReason: document.rejectReason?.reason ?? null,
        rejectReasonDetails: document.rejectReason ?? null,
        uploadDate: document.createdAt,
        relatedInformation: {
            customer: {
                id: document.user?.id ?? null,
                name: customerName,
                email: document.user?.email ?? quoteRequest?.customer?.email ?? null
            },
            shipment: document.shipment
                ? {
                      id: document.shipment.id,
                      shipmentId: document.shipment.sku ?? null,
                      status: document.shipment.status
                  }
                : null,
            vehicle: vehicle
                ? `${vehicle.make} ${vehicle.model} ${vehicle.year}`.trim()
                : null,
            vehicleDetails: vehicle ?? null,
            route: route
                ? `${route.originPort} -> ${route.destinationPort}`
                : null,
            routeFull: route
                ? `${route.originPort}, ${route.originCountry} -> ${route.destinationPort}, ${route.destinationCountry}`
                : null,
            routeDetails: route ?? null
        }
    };
};
