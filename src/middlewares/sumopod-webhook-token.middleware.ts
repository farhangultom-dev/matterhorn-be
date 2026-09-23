import { createHash, timingSafeEqual } from 'node:crypto';
import type { RequestHandler } from 'express';
import { getSumopodWebhookEnv } from '../config/env';
import { AppError } from '../utils/app-error';

const digestToken = (token: string): Buffer => createHash('sha256').update(token, 'utf8').digest();

export const verifySumopodWebhookToken: RequestHandler = (request, _response, next) => {
  let expectedToken: string;
  try {
    const webhookEnv = getSumopodWebhookEnv();
    if (!webhookEnv.configured) {
      next(new AppError(503, 'WEBHOOK_UNAVAILABLE', 'Payment webhook is unavailable'));
      return;
    }
    expectedToken = webhookEnv.token;
  } catch {
    next(new AppError(503, 'WEBHOOK_UNAVAILABLE', 'Payment webhook is unavailable'));
    return;
  }

  const receivedToken = request.header('X-Webhook-Token');
  if (!receivedToken) {
    next(new AppError(401, 'INVALID_WEBHOOK_TOKEN', 'Invalid webhook token'));
    return;
  }

  const expectedDigest = digestToken(expectedToken);
  const receivedDigest = digestToken(receivedToken);
  if (!timingSafeEqual(expectedDigest, receivedDigest)) {
    next(new AppError(401, 'INVALID_WEBHOOK_TOKEN', 'Invalid webhook token'));
    return;
  }

  next();
};
