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

export const MAX_COMMUNITY_MEDIA_BYTES = MAX_PROFILE_PHOTO_BYTES;

export type CommunityMediaKind = 'logo' | 'cover';

export interface CommunityMediaFile {
  readonly buffer: Buffer;
  readonly mimetype: string;
}

export interface UploadedCommunityMedia {
  readonly key: string;
  readonly url: string;
}

const logStorageFailure = (operation: string, error: unknown): void => {
  const candidate = error as { name?: unknown; code?: unknown; $metadata?: { httpStatusCode?: unknown; requestId?: unknown } };
  console.error('Community media S3 ' + operation + ' failed', {
    category: typeof candidate?.name === 'string' ? candidate.name : 'UnknownError',
    code: typeof candidate?.code === 'string' ? candidate.code : undefined,
    httpStatusCode: typeof candidate?.$metadata?.httpStatusCode === 'number' ? candidate.$metadata.httpStatusCode : undefined,
    requestId: typeof candidate?.$metadata?.requestId === 'string' ? candidate.$metadata.requestId : undefined,
  });
};

const configuredStorage = (): { env: S3Env; client: ReturnType<typeof createProfilePhotoS3Client> } => {
  const env = getS3Env();
  if (!env.configured) throw new StorageUnavailableError('Community media storage is not configured');
  return { env, client: createProfilePhotoS3Client(env) };
};

const escapeRegExp = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const communityMediaKeyExpression = (communityId: string, kind: CommunityMediaKind): RegExp =>
  new RegExp('^community-media/' + escapeRegExp(communityId) + '/' + kind + '/[a-f0-9]{32}\\.(jpg|png|webp)$');

const isManagedCommunityMediaKey = (value: string, communityId: string, kind: CommunityMediaKind): boolean =>
  communityMediaKeyExpression(communityId, kind).test(value);

const isAnyManagedCommunityMediaKey = (value: string): boolean =>
  /^community-media\/[0-9a-f-]{36}\/(logo|cover)\/[a-f0-9]{32}\.(jpg|png|webp)$/.test(value);

const createCommunityMediaKey = (communityId: string, kind: CommunityMediaKind, extension: string): string =>
  'community-media/' + communityId + '/' + kind + '/' + randomUUID().replaceAll('-', '') + '.' + extension;

export const uploadCommunityMedia = async ({ communityId, kind, file }: { communityId: string; kind: CommunityMediaKind; file: CommunityMediaFile }): Promise<UploadedCommunityMedia> => {
  const inspected = inspectImageBuffer(file as ProfilePhotoFile);
  let storage: ReturnType<typeof configuredStorage>;
  try {
    storage = configuredStorage();
    const key = createCommunityMediaKey(communityId, kind, inspected.extension);
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
    throw new StorageUnavailableError('Community media storage is unavailable');
  }
};

export const deleteUploadedCommunityMedia = async (key: string): Promise<void> => {
  if (!isAnyManagedCommunityMediaKey(key)) return;
  const storage = configuredStorage();
  await storage.client.send(new DeleteObjectCommand({ Bucket: storage.env.bucket, Key: key }));
};

export const deleteManagedCommunityMediaByUrl = async ({ communityId, kind, url }: { communityId: string; kind: CommunityMediaKind; url: string }): Promise<void> => {
  try {
    const env = getS3Env();
    if (!env.configured) return;
    const base = new URL(env.publicBaseUrl);
    const candidate = new URL(url);
    const basePath = base.pathname.replace(/\/$/, '');
    const prefix = basePath + '/';
    if (candidate.origin !== base.origin || candidate.search || candidate.hash || candidate.username || candidate.password || !candidate.pathname.startsWith(prefix)) return;
    const key = decodeURIComponent(candidate.pathname.slice(prefix.length));
    if (!isManagedCommunityMediaKey(key, communityId, kind)) return;
    await createProfilePhotoS3Client(env).send(new DeleteObjectCommand({ Bucket: env.bucket, Key: key }));
  } catch (error) {
    // Old-object cleanup is best effort and must not fail a committed database update.
    logStorageFailure('delete', error);
  }
};
