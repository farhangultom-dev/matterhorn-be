import { Router } from 'express';
import { createPaymentController, getPaymentOrderController } from '../controllers/payment.controller';
import { processSumopodWebhookController } from '../controllers/payment-webhook.controller';
import { authenticate } from '../middlewares/authenticate.middleware';
import { validatePaymentIdempotencyKey } from '../middlewares/payment-idempotency.middleware';
import { verifySumopodWebhookToken } from '../middlewares/sumopod-webhook-token.middleware';
import { validateBody, validateParams } from '../middlewares/validate.middleware';
import { createPaymentSchema, paymentOrderParamsSchema } from '../validations/payment.validation';
import { sumopodWebhookSchema } from '../validations/payment-webhook.validation';

const router = Router();

router.post('/webhooks/sumopod', verifySumopodWebhookToken, validateBody(sumopodWebhookSchema), processSumopodWebhookController);
router.get('/orders/:orderId', authenticate, validateParams(paymentOrderParamsSchema), getPaymentOrderController);
router.post('/', authenticate, validatePaymentIdempotencyKey, validateBody(createPaymentSchema), createPaymentController);

export default router;
