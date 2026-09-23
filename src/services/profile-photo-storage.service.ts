import { DeleteObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { randomUUID } from 'node:crypto';
import { getS3Env, type S3Env } from '../config/env';

export const MAX_PROFILE_PHOTO_BYTES = 5 * 1024 * 1024;

export interface ProfilePhotoFile {
  readonly buffer: Buffer;
  readonly mimetype: string;
}

export interface InspectedImage {
  readonly contentType: 'image/jpeg' | 'image/png' | 'image/webp';
  readonly extension: 'jpg' | 'png' | 'webp';
}

export interface UploadedProfilePhoto {
  readonly key: string;
  readonly url: string;
}

export class StorageUnavailableError extends Error {
  public constructor(message = 'Profile photo storage is unavailable') {
    super(message);
    this.name = 'StorageUnavailableError';
  }
}

export class UnsupportedImageTypeError extends Error {
  public constructor() {
    super('Unsupported or mismatched image type');
    this.name = 'UnsupportedImageTypeError';
  }
}

export class InvalidProfilePhotoSizeError extends Error {
  public constructor() {
    super('Invalid profile photo size');
    this.name = 'InvalidProfilePhotoSizeError';
  }
}

export const inspectImageBuffer = (file: ProfilePhotoFile): InspectedImage => {
  if (file.buffer.length === 0 || file.buffer.length > MAX_PROFILE_PHOTO_BYTES) {
    throw new InvalidProfilePhotoSizeError();
  }
  const isJpeg = file.buffer.length >= 3 && file.buffer[0] === 0xff && file.buffer[1] === 0xd8 && file.buffer[2] === 0xff;
  const isPng = file.buffer.length >= 8 && file.buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  const isWebp = file.buffer.length >= 12 && file.buffer.toString('ascii', 0, 4) === 'RIFF' && file.buffer.toString('ascii', 8, 12) === 'WEBP';
  const detected = isJpeg ? { contentType: 'image/jpeg' as const, extension: 'jpg' as const } : isPng ? { contentType: 'image/png' as const, extension: 'png' as const } : isWebp ? { contentType: 'image/webp' as const, extension: 'webp' as const } : undefined;
  if (!detected || detected.contentType !== file.mimetype) throw new UnsupportedImageTypeError();
  return detected;
};

export const createProfilePhotoS3Client = (env: S3Env): S3Client => new S3Client({
  region: env.region,
  credentials: env.credentials,
  forcePathStyle: env.forcePathStyle,
  ...(env.endpoint ? { endpoint: env.endpoint } : {}),
});

const logStorageFailure = (operation: string, error: unknown): void => {
  const candidate = error as { name?: unknown; code?: unknown; $metadata?: { httpStatusCode?: unknown; requestId?: unknown } };
  console.error('Profile photo S3 ' + operation + ' failed', {
    category: typeof candidate?.name === 'string' ? candidate.name : 'UnknownError',
    code: typeof candidate?.code === 'string' ? candidate.code : undefined,
    httpStatusCode: typeof candidate?.$metadata?.httpStatusCode === 'number' ? candidate.$metadata.httpStatusCode : undefined,
    requestId: typeof candidate?.$metadata?.requestId === 'string' ? candidate.$metadata.requestId : undefined,
  });
};

const configuredStorage = (): { env: S3Env; client: S3Client } => {
  const env = getS3Env();
  if (!env.configured) throw new StorageUnavailableError('Profile photo storage is not configured');
  return { env, client: createProfilePhotoS3Client(env) };
};

const managedPhotoKeyForUser = (value: string, userId: string): string | undefined => {
  const expression = new RegExp('^profile-photos/' + userId.replace(/[.*+?^$()|[\]{}]/g, '\\$&') + '/[a-f0-9]{32}\\.(jpg|png|webp)$');
  return expression.test(value) ? value : undefined;
};

export const uploadProfilePhoto = async ({ userId, file }: { userId: string; file: ProfilePhotoFile }): Promise<UploadedProfilePhoto> => {
  const inspected = inspectImageBuffer(file);
  let storage: ReturnType<typeof configuredStorage>;
  try {
    storage = configuredStorage();
    const key = 'profile-photos/' + userId + '/' + randomUUID().replaceAll('-', '') + '.' + inspected.extension;
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
    if (error instanceof StorageUnavailableError) throw error;
    logStorageFailure('upload', error);
    throw new StorageUnavailableError();
  }
};

export const deleteUploadedProfilePhoto = async (key: string): Promise<void> => {
  const storage = configuredStorage();
  await storage.client.send(new DeleteObjectCommand({ Bucket: storage.env.bucket, Key: key }));
};

export const deleteManagedProfilePhotoByUrl = async ({ userId, url }: { userId: string; url: string }): Promise<void> => {
  let env: ReturnType<typeof getS3Env>;
  try {
    env = getS3Env();
  } catch {
    return;
  }
  if (!env.configured) return;
  try {
    const base = new URL(env.publicBaseUrl);
    const candidate = new URL(url);
    const basePath = base.pathname.replace(/\/$/, '');
    const prefix = basePath + '/';
    if (candidate.origin !== base.origin || candidate.search || candidate.hash || candidate.username || candidate.password || !candidate.pathname.startsWith(prefix)) return;
    const key = decodeURIComponent(candidate.pathname.slice(prefix.length));
    if (!managedPhotoKeyForUser(key, userId)) return;
    await createProfilePhotoS3Client(env).send(new DeleteObjectCommand({ Bucket: env.bucket, Key: key }));
  } catch {
    // Cleanup is best effort and must not fail a committed profile update.
  }
};
