import type { RequestHandler } from 'express';
import { processSumopodWebhook } from '../services/payment-webhook.service';
import type { SumopodWebhookEvent } from '../validations/payment-webhook.validation';
import { successResponse } from '../views/response.view';

export const processSumopodWebhookController: RequestHandler = async (_request, response) => {
  const event = response.locals.validatedBody as SumopodWebhookEvent;
  const result = await processSumopodWebhook({ event, receivedAt: new Date() });
  response.status(200).json(successResponse('Webhook processed', result));
};
