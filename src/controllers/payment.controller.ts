import type { RequestHandler } from 'express';
import { getOwnedPaymentCheckout, createPaymentCheckout } from '../services/payment.service';
import type { CreatePaymentInput, PaymentOrderParams } from '../validations/payment.validation';
import { successResponse } from '../views/response.view';
import { presentPaymentCheckout } from '../views/payment.view';

export const createPaymentController: RequestHandler = async (request, response) => {
  const result = await createPaymentCheckout({
    userId: request.auth!.userId,
    checkoutKey: response.locals.idempotencyKey as string,
    input: response.locals.validatedBody as CreatePaymentInput,
  });
  if (result.statusCode === 202) {
    response.status(202).json(successResponse('Payment initiation pending', {
      orderId: result.pendingOrderId,
      initiationStatus: result.pendingInitiationStatus ?? 'unknown',
    }));
    return;
  }
  if (!result.checkout) throw new Error('Payment checkout was not returned.');
  response.status(result.statusCode).json(successResponse(
    result.statusCode === 201 ? 'Payment created' : 'Payment checkout retrieved',
    presentPaymentCheckout(result.checkout),
  ));
};

export const getPaymentOrderController: RequestHandler = async (request, response) => {
  const { orderId } = response.locals.validatedParams as PaymentOrderParams;
  const checkout = await getOwnedPaymentCheckout({ orderId, userId: request.auth!.userId });
  response.json(successResponse('Payment order retrieved', presentPaymentCheckout(checkout)));
};
