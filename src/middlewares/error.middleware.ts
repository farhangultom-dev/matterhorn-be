import type { ErrorRequestHandler } from 'express';
import { AppError, isAppError } from '../utils/app-error';
import { errorResponse } from '../views/response.view';

export const errorHandler: ErrorRequestHandler = (error, request, response, next) => {
  if (response.headersSent) {
    next(error);
    return;
  }
  if (error instanceof SyntaxError && 'body' in error) {
    const isSumopodWebhook = request.path === '/api/v1/payments/webhooks/sumopod';
    response.status(400).json(errorResponse('Malformed JSON', isSumopodWebhook ? 'VALIDATION_ERROR' : 'INVALID_JSON'));
    return;
  }
  if (typeof error === 'object' && error !== null && 'type' in error && error.type === 'entity.too.large') {
    response.status(413).json(errorResponse('Request body is too large', 'PAYLOAD_TOO_LARGE'));
    return;
  }
  if (isAppError(error)) {
    response.status(error.statusCode).json(errorResponse(error.message, error.code, error.details));
    return;
  }
  if (error instanceof AppError) {
    response.status(error.statusCode).json(errorResponse(error.message, error.code));
    return;
  }
  console.error(error instanceof Error ? error.message : 'Unknown error');
  response.status(500).json(errorResponse('An unexpected error occurred', 'INTERNAL_SERVER_ERROR'));
};
