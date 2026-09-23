import type { RequestHandler } from 'express';
import multer, { MulterError } from 'multer';
import { z } from 'zod';
import { AppError } from '../utils/app-error';
import { createEventSchema } from '../validations/event.validation';
import { inspectImageBuffer, InvalidProfilePhotoSizeError, UnsupportedImageTypeError } from '../services/profile-photo-storage.service';
import { MAX_EVENT_POSTER_BYTES, type EventPosterFile } from '../services/event-poster-storage.service';
import { validateBody } from './validate.middleware';

const allowedMimeTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);

class InvalidEventPosterUploadError extends Error {
  public constructor(message = 'Invalid event poster upload') {
    super(message);
    this.name = 'InvalidEventPosterUploadError';
  }
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_EVENT_POSTER_BYTES, files: 1, fields: 1, parts: 2 },
  fileFilter: (_request, file, callback) => {
    if (file.fieldname !== 'posterUrl') {
      callback(new InvalidEventPosterUploadError());
      return;
    }
    if (!allowedMimeTypes.has(file.mimetype)) {
      callback(new UnsupportedImageTypeError());
      return;
    }
    callback(null, true);
  },
}).single('posterUrl');

const mapMulterError = (error: unknown): AppError | undefined => {
  if (error instanceof UnsupportedImageTypeError) return new AppError(415, 'UNSUPPORTED_IMAGE_TYPE', 'Unsupported image type');
  if (error instanceof InvalidEventPosterUploadError) return new AppError(400, 'INVALID_UPLOAD', error.message);
  if (error instanceof MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') return new AppError(413, 'FILE_TOO_LARGE', 'Event poster must be at most 5 MiB');
    return new AppError(400, 'INVALID_UPLOAD', 'Malformed or unexpected multipart upload');
  }
  return undefined;
};

const parseMultipartData = (raw: unknown): unknown => {
  if (raw === undefined || Array.isArray(raw)) throw new AppError(400, 'INVALID_UPLOAD', 'A single data JSON part is required');
  if (typeof raw !== 'string') throw new AppError(400, 'VALIDATION_ERROR', 'Multipart data must be a JSON object string');
  try {
    return JSON.parse(raw);
  } catch {
    throw new AppError(400, 'VALIDATION_ERROR', 'Multipart data must contain valid JSON');
  }
};

export const parseEventCreateRequest: RequestHandler = (request, response, next) => {
  if (request.is('application/json')) {
    validateBody(createEventSchema)(request, response, next);
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
    try {
      const multipartBody = (request.body ?? {}) as Record<string, unknown>;
      if (Object.keys(multipartBody).some((fieldName) => fieldName !== 'data')) {
        throw new AppError(400, 'INVALID_UPLOAD', 'Only data and posterUrl multipart parts are allowed');
      }
      const body = createEventSchema.parse(parseMultipartData(multipartBody.data));
      response.locals.validatedBody = body;
      if (request.file) {
        const file: EventPosterFile = { buffer: request.file.buffer, mimetype: request.file.mimetype };
        const inspected = inspectImageBuffer(file);
        if (inspected.contentType !== request.file.mimetype) throw new UnsupportedImageTypeError();
        response.locals.eventPosterFile = file;
      }
      next();
    } catch (parseError) {
      if (parseError instanceof UnsupportedImageTypeError) {
        next(new AppError(415, 'UNSUPPORTED_IMAGE_TYPE', 'Unsupported image type'));
        return;
      }
      if (parseError instanceof InvalidProfilePhotoSizeError) {
        next(new AppError(400, 'INVALID_UPLOAD', 'Event poster must not be empty'));
        return;
      }
      if (parseError instanceof AppError) {
        next(parseError);
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
