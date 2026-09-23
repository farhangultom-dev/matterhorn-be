import type { RequestHandler } from 'express';
import { getDatabase } from '../config/database';
import { successResponse } from '../views/response.view';
import { AppError } from '../utils/app-error';

export const healthController: RequestHandler = async (_request, response, next) => {
  try {
    await getDatabase().raw('select 1').timeout(3000);
    response.json(successResponse('Service is healthy', { status: 'ok', database: 'up' }));
  } catch {
    next(new AppError(503, 'SERVICE_UNAVAILABLE', 'Service is unavailable'));
  }
};
