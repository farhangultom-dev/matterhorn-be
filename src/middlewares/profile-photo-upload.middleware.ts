import type { RequestHandler } from 'express';
import multer, { MulterError } from 'multer';
import { z } from 'zod';
import { AppError } from '../utils/app-error';
import { validateBody } from './validate.middleware';
import { updateUserDetailsFieldsSchema, updateUserDetailsSchema } from '../validations/user-details.validation';
import { inspectImageBuffer, InvalidProfilePhotoSizeError, MAX_PROFILE_PHOTO_BYTES, type ProfilePhotoFile, UnsupportedImageTypeError as StorageUnsupportedImageTypeError } from '../services/profile-photo-storage.service';

const allowedMimeTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);

class InvalidUploadError extends Error {
  public constructor() {
    super('Invalid profile photo upload');
    this.name = 'InvalidUploadError';
  }
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_PROFILE_PHOTO_BYTES, files: 1, fields: 1, parts: 2 },
  fileFilter: (_request, file, callback) => {
    if (file.fieldname !== 'profilePhoto') {
      callback(new InvalidUploadError());
      return;
    }
    if (!allowedMimeTypes.has(file.mimetype)) {
      callback(new StorageUnsupportedImageTypeError());
      return;
    }
    callback(null, true);
  },
}).single('profilePhoto');

const mapMulterError = (error: unknown): AppError | undefined => {
  if (error instanceof StorageUnsupportedImageTypeError) return new AppError(415, 'UNSUPPORTED_IMAGE_TYPE', 'Unsupported image type');
  if (error instanceof InvalidUploadError) return new AppError(400, 'INVALID_UPLOAD', error.message);
  if (error instanceof MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') return new AppError(413, 'FILE_TOO_LARGE', 'Profile photo must be at most 5 MiB');
    return new AppError(400, 'INVALID_UPLOAD', 'Malformed or unexpected multipart upload');
  }
  return undefined;
};

const parseMultipartData = (raw: unknown): unknown => {
  if (raw === undefined) return {};
  if (typeof raw !== 'string') throw new AppError(400, 'VALIDATION_ERROR', 'Multipart data must be a JSON object string');
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new AppError(400, 'VALIDATION_ERROR', 'Multipart data must contain valid JSON');
  }
  return parsed;
};

export const parseUserDetailsUpdate: RequestHandler = (request, response, next) => {
  if (request.is('application/json')) {
    validateBody(updateUserDetailsSchema)(request, response, next);
    return;
  }
  if (!request.is('multipart/form-data')) {
    next(new AppError(415, 'UNSUPPORTED_MEDIA_TYPE', 'Content-Type must be application/json or multipart/form-data'));
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
      next(new AppError(400, 'INVALID_UPLOAD', 'A profilePhoto file is required'));
      return;
    }
    const file: ProfilePhotoFile = { buffer: request.file.buffer, mimetype: request.file.mimetype };
    try {
      const inspected = inspectImageBuffer(file);
      if (inspected.contentType !== request.file.mimetype) throw new StorageUnsupportedImageTypeError();
      const data = updateUserDetailsFieldsSchema.parse(parseMultipartData(request.body.data));
      response.locals.validatedBody = data;
      response.locals.profilePhoto = file;
      next();
    } catch (parseError) {
      if (parseError instanceof StorageUnsupportedImageTypeError) {
        next(new AppError(415, 'UNSUPPORTED_IMAGE_TYPE', 'Unsupported image type'));
        return;
      }
      if (parseError instanceof z.ZodError) {
        next(new AppError(400, 'VALIDATION_ERROR', 'Validation failed', parseError.issues.map((issue) => ({ field: issue.path.join('.') || 'data', message: issue.message }))));
        return;
      }
      if (parseError instanceof InvalidProfilePhotoSizeError) {
        next(new AppError(400, 'INVALID_UPLOAD', 'Profile photo must not be empty'));
        return;
      }
      next(parseError);
    }
  });
};
