import type { RequestHandler } from 'express';
import { AppError } from '../utils/app-error';

export const notFound: RequestHandler = (_request, _response, next) => next(new AppError(404, 'NOT_FOUND', 'Route not found'));
