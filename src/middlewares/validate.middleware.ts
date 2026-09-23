import type { RequestHandler } from 'express';
import { z } from 'zod';
import { AppError } from '../utils/app-error';

export const validateBody = <T>(schema: z.ZodType<T>): RequestHandler => async (request, response, next) => {
  try {
    response.locals.validatedBody = await schema.parseAsync(request.body);
    next();
  } catch (error) {
    if (error instanceof z.ZodError) {
      next(new AppError(400, 'VALIDATION_ERROR', 'Validation failed', error.issues.map((issue) => ({ field: issue.path.join('.') || 'body', message: issue.message }))));
      return;
    }
    next(error);
  }
};

const validateRequestPart = <T>(part: 'params' | 'query', localKey: 'validatedParams' | 'validatedQuery', schema: z.ZodType<T>): RequestHandler => async (request, response, next) => {
  try {
    response.locals[localKey] = await schema.parseAsync(request[part]);
    next();
  } catch (error) {
    if (error instanceof z.ZodError) {
      next(new AppError(400, 'VALIDATION_ERROR', 'Validation failed', error.issues.map((issue) => ({ field: issue.path.join('.') || part, message: issue.message }))));
      return;
    }
    next(error);
  }
};

export const validateParams = <T>(schema: z.ZodType<T>): RequestHandler => validateRequestPart('params', 'validatedParams', schema);

export const validateQuery = <T>(schema: z.ZodType<T>): RequestHandler => validateRequestPart('query', 'validatedQuery', schema);
