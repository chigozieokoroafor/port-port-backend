import fs from 'fs';
import { object, string, type ObjectSchema } from 'yup';
import { prisma } from '../../../config/database';
import { ApiError } from '../../../utils/ApiError';
import { uploadToBunnyStorage } from '../../../services/bunny/service';
import logger from '../../../utils/logger';

export const UploadDocumentDTO = object({
  name: string().trim().required('Document name is required'),
  shipmentUid: string().trim().optional(),
});

export type TUploadDocumentDTO = typeof UploadDocumentDTO.__outputType;

export async function validateDTO<T>(dto: any, schema: ObjectSchema<any>) {
  const validatedDTO = await schema.validate(dto, {
    abortEarly: false,
    stripUnknown: true,
  });
  return validatedDTO;
}

export const removeLocalFile = async (filePath?: string) => {
  if (!filePath) return;
  try {
    await fs.promises.unlink(filePath);
  } catch (err) {
    logger.warn(`Failed to delete local temporary file ${filePath}: ${err}`);
  }
};

export const uploadDocumentAction = async (
  dto: TUploadDocumentDTO,
  file: Express.Multer.File,
  userId: string
) => {
  let resolvedShipmentId: string | undefined;

  try {
    // 1. If shipmentUid is provided, resolve the Shipment by id (if valid ObjectId) or sku
    if (dto.shipmentUid) {
      const isObjectId = /^[0-9a-fA-F]{24}$/.test(dto.shipmentUid);

      const shipment = await prisma.shipment.findFirst({
        where: isObjectId
          ? {
              OR: [{ id: dto.shipmentUid }, { sku: dto.shipmentUid }],
            }
          : { sku: dto.shipmentUid },
        select: { id: true },
      });

      if (!shipment) {
        throw new ApiError(404, 'Shipment not found for the provided shipmentUid');
      }

      resolvedShipmentId = shipment.id;
    }

    // 2. Upload the temporary disk file to Bunny Storage
    const fileUrl = await uploadToBunnyStorage({
      localFilePath: file.path,
      remoteFileName: file.filename,
      folder: 'documents',
      mimeType: file.mimetype,
    });

    // 3. Create the Documents record in Prisma
    const document = await prisma.documents.create({
      data: {
        name: dto.name,
        url: fileUrl,
        mimeType: file.mimetype,
        fileSize: file.size,
        userId,
        ...(resolvedShipmentId ? { shipmentId: resolvedShipmentId } : {}),
      },
      select: {
        id: true,
        name: true,
        url: true,
        mimeType: true,
        fileSize: true,
        userId: true,
        shipmentId: true,
        createdAt: true,
      },
    });

    return document;
  } finally {
    // 4. Always delete the temporary saved file from device storage
    await removeLocalFile(file.path);
  }
};
