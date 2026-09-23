import type { RequestHandler } from 'express';
import { createPaymentHeadersSchema } from '../validations/payment.validation';
import { AppError } from '../utils/app-error';

export const validatePaymentIdempotencyKey: RequestHandler = (request, response, next) => {
  const parsed = createPaymentHeadersSchema.safeParse({ idempotencyKey: request.header('Idempotency-Key') });
  if (!parsed.success) {
    const details = parsed.error.issues.map((issue) => ({ field: issue.path.join('.') || 'Idempotency-Key', message: issue.message }));
    next(new AppError(400, 'VALIDATION_ERROR', 'A valid Idempotency-Key UUID header is required', details));
    return;
  }
  response.locals.idempotencyKey = parsed.data.idempotencyKey.toLowerCase();
  next();
};
