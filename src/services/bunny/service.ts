import fs from 'fs';
import { ApiError } from '../../utils/ApiError';
import logger from '../../utils/logger';

export interface BunnyUploadOptions {
  localFilePath: string;
  remoteFileName: string;
  folder?: string;
  mimeType?: string;
}

/**
 * Uploads a local file from disk to Bunny Storage and returns the public CDN URL.
 */
export const uploadToBunnyStorage = async ({
  localFilePath,
  remoteFileName,
  folder = 'documents',
  mimeType = 'application/octet-stream',
}: BunnyUploadOptions): Promise<string> => {
  const storageZone = process.env.BUNNY_STORAGE_ZONE;
  const apiKey = process.env.BUNNY_STORAGE_API_KEY;
  const storageHost = process.env.BUNNY_STORAGE_HOST || 'storage.bunnycdn.com';
  const pullZoneUrl = process.env.BUNNY_PULL_ZONE_URL;

  if (!storageZone || !apiKey || !pullZoneUrl) {
    throw new ApiError(
      500,
      'Bunny Storage environment configuration is missing (BUNNY_STORAGE_ZONE, BUNNY_STORAGE_API_KEY, BUNNY_PULL_ZONE_URL)'
    );
  }

  const cleanHost = storageHost.replace(/^https?:\/\//, '').replace(/\/+$/, '');
  const cleanFolder = folder.replace(/^\/+|\/+$/g, '');
  const encodedFileName = encodeURIComponent(remoteFileName);
  const relativePath = cleanFolder
    ? `${cleanFolder}/${encodedFileName}`
    : encodedFileName;

  const uploadUrl = `https://${cleanHost}/${storageZone}/${relativePath}`;

  const fileBuffer = await fs.promises.readFile(localFilePath);

  const response = await fetch(uploadUrl, {
    method: 'PUT',
    headers: {
      AccessKey: apiKey,
      'Content-Type': mimeType,
    },
    body: fileBuffer,
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    logger.error(
      `Bunny Storage upload failed (${response.status}): ${errorText}`
    );
    throw new ApiError(
      502,
      `Failed to upload file to Bunny Storage: ${response.statusText}`
    );
  }

  const cleanPullZone = pullZoneUrl.replace(/\/+$/, '');
  const formattedPullZone = /^https?:\/\//i.test(cleanPullZone)
    ? cleanPullZone
    : `https://${cleanPullZone}`;

  return `${formattedPullZone}/${relativePath}`;
};
