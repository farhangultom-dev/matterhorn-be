import type { RequestHandler } from 'express';
import multer, { MulterError } from 'multer';
import { z } from 'zod';
import { AppError } from '../utils/app-error';
import { createOrganizerSchema } from '../validations/organizer.validation';
import { inspectImageBuffer, InvalidProfilePhotoSizeError, UnsupportedImageTypeError } from '../services/profile-photo-storage.service';
import { MAX_ORGANIZER_LOGO_BYTES, type OrganizerLogoFile } from '../services/organizer-logo-storage.service';
import { validateBody } from './validate.middleware';

const allowedMimeTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);

class InvalidOrganizerLogoUploadError extends Error {
  public constructor() {
    super('Invalid organizer logo upload');
    this.name = 'InvalidOrganizerLogoUploadError';
  }
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_ORGANIZER_LOGO_BYTES, files: 1, fields: 7, parts: 8 },
  fileFilter: (_request, file, callback) => {
    if (file.fieldname !== 'logo') {
      callback(new InvalidOrganizerLogoUploadError());
      return;
    }
    if (!allowedMimeTypes.has(file.mimetype)) {
      callback(new UnsupportedImageTypeError());
      return;
    }
    callback(null, true);
  },
}).single('logo');

const mapMulterError = (error: unknown): AppError | undefined => {
  if (error instanceof UnsupportedImageTypeError) return new AppError(415, 'UNSUPPORTED_IMAGE_TYPE', 'Unsupported image type');
  if (error instanceof InvalidOrganizerLogoUploadError) return new AppError(400, 'INVALID_UPLOAD', error.message);
  if (error instanceof MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') return new AppError(413, 'FILE_TOO_LARGE', 'Organizer logo must be at most 5 MiB');
    return new AppError(400, 'INVALID_UPLOAD', 'Malformed or unexpected multipart upload');
  }
  return undefined;
};

const parseMultipartData = (raw: unknown, fallback: unknown): unknown => {
  if (raw === undefined) return fallback;
  if (typeof raw !== 'string') throw new AppError(400, 'VALIDATION_ERROR', 'Multipart data must be a JSON object string');
  try {
    return JSON.parse(raw);
  } catch {
    throw new AppError(400, 'VALIDATION_ERROR', 'Multipart data must contain valid JSON');
  }
};

export const parseOrganizerCreate: RequestHandler = (request, response, next) => {
  if (request.is('application/json')) {
    validateBody(createOrganizerSchema)(request, response, next);
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
      next(new AppError(400, 'INVALID_UPLOAD', 'A logo file is required for multipart requests'));
      return;
    }

    const file: OrganizerLogoFile = { buffer: request.file.buffer, mimetype: request.file.mimetype };
    try {
      const inspected = inspectImageBuffer(file);
      if (inspected.contentType !== request.file.mimetype) throw new UnsupportedImageTypeError();
      const directBody = Object.fromEntries(Object.entries(request.body as Record<string, unknown>)
        .filter(([fieldName]) => fieldName !== 'data')
        .map(([fieldName, value]) => ([fieldName, ['userId', 'communityId', 'logoUrl', 'email', 'phone'].includes(fieldName) && value === 'null' ? null : value])));
      response.locals.validatedBody = createOrganizerSchema.parse(parseMultipartData(request.body.data, directBody));
      response.locals.organizerLogo = file;
      next();
    } catch (parseError) {
      if (parseError instanceof UnsupportedImageTypeError) {
        next(new AppError(415, 'UNSUPPORTED_IMAGE_TYPE', 'Unsupported image type'));
        return;
      }
      if (parseError instanceof InvalidProfilePhotoSizeError) {
        next(new AppError(400, 'INVALID_UPLOAD', 'Organizer logo must not be empty'));
        return;
      }
      if (parseError instanceof z.ZodError) {
        next(new AppError(400, 'VALIDATION_ERROR', 'Validation failed', parseError.issues.map((issue) => ({ field: issue.path.join('.') || 'data', message: issue.message }))));
        return;
      }
      next(parseError);
    }
  });
};
