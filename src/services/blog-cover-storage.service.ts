import { DeleteObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { randomUUID } from 'node:crypto';
import { getS3Env, type S3Env } from '../config/env';
import {
  createProfilePhotoS3Client,
  inspectImageBuffer,
  InvalidProfilePhotoSizeError,
  MAX_PROFILE_PHOTO_BYTES,
  StorageUnavailableError,
  UnsupportedImageTypeError,
  type ProfilePhotoFile,
} from './profile-photo-storage.service';

export const MAX_BLOG_COVER_BYTES = MAX_PROFILE_PHOTO_BYTES;

export interface BlogCoverFile {
  readonly buffer: Buffer;
  readonly mimetype: string;
}

export interface UploadedBlogCover {
  readonly key: string;
  readonly url: string;
}

const configuredStorage = (): { readonly env: S3Env; readonly client: ReturnType<typeof createProfilePhotoS3Client> } => {
  const env = getS3Env();
  if (!env.configured) throw new StorageUnavailableError('Blog cover storage is not configured');
  return { env, client: createProfilePhotoS3Client(env) };
};

const isManagedBlogCoverKey = (value: string): boolean => /^blog-media\/[0-9a-f-]{36}\/cover\/[a-f0-9]{32}\.(jpg|png|webp)$/.test(value);

const logStorageFailure = (operation: string, error: unknown): void => {
  const candidate = error as { name?: unknown; code?: unknown; $metadata?: { httpStatusCode?: unknown; requestId?: unknown } };
  console.error('Blog cover S3 ' + operation + ' failed', {
    category: typeof candidate?.name === 'string' ? candidate.name : 'UnknownError',
    code: typeof candidate?.code === 'string' ? candidate.code : undefined,
    httpStatusCode: typeof candidate?.$metadata?.httpStatusCode === 'number' ? candidate.$metadata.httpStatusCode : undefined,
    requestId: typeof candidate?.$metadata?.requestId === 'string' ? candidate.$metadata.requestId : undefined,
  });
};

export const uploadBlogCover = async ({ blogId, file }: { blogId: string; file: BlogCoverFile }): Promise<UploadedBlogCover> => {
  const inspected = inspectImageBuffer(file as ProfilePhotoFile);
  try {
    const storage = configuredStorage();
    const key = 'blog-media/' + blogId + '/cover/' + randomUUID().replaceAll('-', '') + '.' + inspected.extension;
    await storage.client.send(new PutObjectCommand({
      Bucket: storage.env.bucket,
      Key: key,
      Body: file.buffer,
      ContentLength: file.buffer.length,
      ContentType: inspected.contentType,
      CacheControl: 'public, max-age=31536000, immutable',
    }));
    return { key, url: storage.env.publicBaseUrl + '/' + key };
  } catch (error) {
    if (error instanceof StorageUnavailableError || error instanceof UnsupportedImageTypeError || error instanceof InvalidProfilePhotoSizeError) throw error;
    logStorageFailure('upload', error);
    throw new StorageUnavailableError('Blog cover storage is unavailable');
  }
};

export const deleteUploadedBlogCover = async (key: string): Promise<void> => {
  if (!isManagedBlogCoverKey(key)) return;
  const storage = configuredStorage();
  await storage.client.send(new DeleteObjectCommand({ Bucket: storage.env.bucket, Key: key }));
};
