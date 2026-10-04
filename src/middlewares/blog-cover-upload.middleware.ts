import type { RequestHandler } from 'express';
import multer, { MulterError } from 'multer';
import { z } from 'zod';
import { AppError } from '../utils/app-error';
import { createBlogSchema } from '../validations/blog.validation';
import { inspectImageBuffer, InvalidProfilePhotoSizeError, UnsupportedImageTypeError } from '../services/profile-photo-storage.service';
import { MAX_BLOG_COVER_BYTES, type BlogCoverFile } from '../services/blog-cover-storage.service';
import { validateBody } from './validate.middleware';

const allowedMimeTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);

class InvalidBlogCoverUploadError extends Error {
  public constructor() {
    super('Invalid blog cover upload');
    this.name = 'InvalidBlogCoverUploadError';
  }
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_BLOG_COVER_BYTES, files: 1, fields: 1, parts: 2 },
  fileFilter: (_request, file, callback) => {
    if (file.fieldname !== 'cover') {
      callback(new InvalidBlogCoverUploadError());
      return;
    }
    if (!allowedMimeTypes.has(file.mimetype)) {
      callback(new UnsupportedImageTypeError());
      return;
    }
    callback(null, true);
  },
}).single('cover');

const mapMulterError = (error: unknown): AppError | undefined => {
  if (error instanceof UnsupportedImageTypeError) return new AppError(415, 'UNSUPPORTED_IMAGE_TYPE', 'Unsupported image type');
  if (error instanceof InvalidBlogCoverUploadError) return new AppError(400, 'INVALID_UPLOAD', error.message);
  if (error instanceof MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') return new AppError(413, 'FILE_TOO_LARGE', 'Blog cover must be at most 5 MiB');
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

export const parseBlogCreateRequest: RequestHandler = (request, response, next) => {
  if (request.is('application/json')) {
    validateBody(createBlogSchema)(request, response, next);
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
        throw new AppError(400, 'INVALID_UPLOAD', 'Only data and cover multipart parts are allowed');
      }
      response.locals.validatedBody = createBlogSchema.parse(parseMultipartData(multipartBody.data));
      if (request.file) {
        const file: BlogCoverFile = { buffer: request.file.buffer, mimetype: request.file.mimetype };
        inspectImageBuffer(file);
        response.locals.blogCoverFile = file;
      }
      next();
    } catch (parseError) {
      if (parseError instanceof UnsupportedImageTypeError) {
        next(new AppError(415, 'UNSUPPORTED_IMAGE_TYPE', 'Unsupported image type'));
        return;
      }
      if (parseError instanceof InvalidProfilePhotoSizeError) {
        next(new AppError(400, 'INVALID_UPLOAD', 'Blog cover must not be empty'));
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
