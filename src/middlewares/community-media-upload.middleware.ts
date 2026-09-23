import type { RequestHandler } from 'express';
import multer, { MulterError } from 'multer';
import { AppError } from '../utils/app-error';
import {
  inspectImageBuffer,
  InvalidProfilePhotoSizeError,
  UnsupportedImageTypeError,
} from '../services/profile-photo-storage.service';
import { MAX_COMMUNITY_MEDIA_BYTES, type CommunityMediaFile } from '../services/community-media-storage.service';

const allowedMimeTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);

class InvalidCommunityMediaUploadError extends Error {
  public constructor() {
    super('Invalid community media upload');
    this.name = 'InvalidCommunityMediaUploadError';
  }
}

const mapMulterError = (error: unknown): AppError | undefined => {
  if (error instanceof UnsupportedImageTypeError) return new AppError(415, 'UNSUPPORTED_IMAGE_TYPE', 'Unsupported image type');
  if (error instanceof InvalidCommunityMediaUploadError) return new AppError(400, 'INVALID_UPLOAD', error.message);
  if (error instanceof MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') return new AppError(413, 'FILE_TOO_LARGE', 'Community media must be at most 5 MiB');
    return new AppError(400, 'INVALID_UPLOAD', 'Malformed or unexpected multipart upload');
  }
  return undefined;
};

const createUpload = (fieldName: 'logo' | 'cover'): RequestHandler => {
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: MAX_COMMUNITY_MEDIA_BYTES, files: 1, fields: 0, parts: 1 },
    fileFilter: (_request, file, callback) => {
      if (file.fieldname !== fieldName) {
        callback(new InvalidCommunityMediaUploadError());
        return;
      }
      if (!allowedMimeTypes.has(file.mimetype)) {
        callback(new UnsupportedImageTypeError());
        return;
      }
      callback(null, true);
    },
  }).single(fieldName);

  return (request, response, next): void => {
    if (!request.is('multipart/form-data')) {
      next(new AppError(415, 'UNSUPPORTED_MEDIA_TYPE', 'Content-Type must be multipart/form-data'));
      return;
    }
    upload(request, response, (error: unknown) => {
      const mapped = mapMulterError(error);
      if (mapped) {
        next(mapped);
        return;
      }
      if (error) {
        next(new AppError(400, 'INVALID_UPLOAD', 'Malformed or unexpected multipart upload'));
        return;
      }
      if (!request.file) {
        next(new AppError(400, 'INVALID_UPLOAD', fieldName + ' file is required'));
        return;
      }
      const file: CommunityMediaFile = { buffer: request.file.buffer, mimetype: request.file.mimetype };
      try {
        const inspected = inspectImageBuffer(file);
        if (inspected.contentType !== request.file.mimetype) throw new UnsupportedImageTypeError();
        response.locals.communityMediaFile = file;
        next();
      } catch (inspectionError) {
        if (inspectionError instanceof UnsupportedImageTypeError) {
          next(new AppError(415, 'UNSUPPORTED_IMAGE_TYPE', 'Unsupported image type'));
          return;
        }
        if (inspectionError instanceof InvalidProfilePhotoSizeError) {
          next(new AppError(400, 'INVALID_UPLOAD', 'Community media must not be empty'));
          return;
        }
        next(inspectionError);
      }
    });
  };
};

export const parseCommunityLogoUpload = createUpload('logo');
export const parseCommunityCoverUpload = createUpload('cover');
