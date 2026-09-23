import type { Knex } from 'knex';
import { getDatabase } from '../config/database';
import {
  findOtherPaymentByProviderReference,
  findSumopodPaymentForUpdate,
  findWebhookOrderForUpdate,
  updateOrderFromWebhook,
  updatePaymentFromWebhook,
  type PaymentTransactionRecord,
  type WebhookOrderRecord,
} from '../models/payment.model';
import type { SumopodPaymentMutationEvent, SumopodWebhookEvent } from '../validations/payment-webhook.validation';
import { AppError } from '../utils/app-error';

export type WebhookProcessingResult = 'processed' | 'duplicate' | 'ignored';

interface WebhookPaymentValues {
  readonly payment: PaymentTransactionRecord;
  readonly order: WebhookOrderRecord;
}

const referenceMismatch = (): AppError => new AppError(409, 'PAYMENT_REFERENCE_MISMATCH', 'Payment reference does not match');
const amountMismatch = (): AppError => new AppError(409, 'PAYMENT_AMOUNT_MISMATCH', 'Payment amount does not match');

const findLockedWebhookPayment = async (transaction: Knex.Transaction, event: SumopodPaymentMutationEvent): Promise<WebhookPaymentValues> => {
  const payment = await findSumopodPaymentForUpdate(transaction, event.data.order_id);
  if (!payment) throw new AppError(404, 'PAYMENT_NOT_FOUND', 'Payment not found');
  const order = await findWebhookOrderForUpdate(transaction, payment.order_id);
  if (!order) throw new AppError(404, 'PAYMENT_NOT_FOUND', 'Payment order not found');
  return { payment, order };
};

const validateWebhookReferences = async (transaction: Knex.Transaction, event: SumopodPaymentMutationEvent, payment: PaymentTransactionRecord): Promise<void> => {
  if (payment.provider_reference && payment.provider_reference !== event.data.payment_id) throw referenceMismatch();
  if (!payment.provider_reference) {
    const otherPayment = await findOtherPaymentByProviderReference(transaction, event.data.payment_id, payment.id);
    if (otherPayment) throw referenceMismatch();
  }
};

const validateWebhookAmounts = (event: SumopodPaymentMutationEvent, { payment, order }: WebhookPaymentValues): boolean => {
  const { amount, fee, net_amount: netAmount } = event.data;
  if (amount !== netAmount + fee || netAmount !== order.subtotal_amount) throw amountMismatch();
  if (order.total_amount !== order.subtotal_amount + order.fee_amount) throw amountMismatch();

  const hasStoredProviderAmounts = payment.provider_fee_amount !== null || payment.provider_net_amount !== null;
  if (hasStoredProviderAmounts) {
    if (payment.provider_fee_amount === null || payment.provider_net_amount === null
      || payment.amount !== amount || payment.provider_fee_amount !== fee || payment.provider_net_amount !== netAmount) {
      throw amountMismatch();
    }
    return false;
  }

  const isUncertainInitiation = payment.initiation_state === 'processing' || payment.initiation_state === 'unknown';
  if (!isUncertainInitiation && (payment.amount !== amount || order.fee_amount !== fee || order.total_amount !== amount)) {
    throw amountMismatch();
  }
  return true;
};

const getTargetStatuses = (event: SumopodPaymentMutationEvent): {
  readonly paymentStatus: 'paid' | 'failed' | 'expired';
  readonly orderStatus: 'paid' | 'cancelled' | 'expired';
} => {
  switch (event.event_type) {
    case 'payment.completed': return { paymentStatus: 'paid', orderStatus: 'paid' };
    case 'payment.failed': return { paymentStatus: 'failed', orderStatus: 'cancelled' };
    case 'payment.expired': return { paymentStatus: 'expired', orderStatus: 'expired' };
  }
};

const isDuplicateEvent = (event: SumopodPaymentMutationEvent, { payment, order }: WebhookPaymentValues): boolean => {
  if (payment.last_webhook_event_type !== event.event_type) return false;
  switch (event.event_type) {
    case 'payment.completed': return payment.status === 'paid' && order.status === 'paid';
    case 'payment.failed': return payment.status === 'failed' && order.status === 'cancelled';
    case 'payment.expired': return payment.status === 'expired' && order.status === 'expired';
  }
};

const shouldIgnoreEvent = (event: SumopodPaymentMutationEvent, { payment, order }: WebhookPaymentValues): boolean => {
  if (payment.status === 'refunded' || order.status === 'refunded') return true;
  if (event.event_type === 'payment.completed') {
    const paymentCanBeCompleted = payment.status === 'pending' || payment.status === 'paid' || payment.status === 'failed' || payment.status === 'expired';
    const orderCanBeCompleted = order.status === 'pending' || order.status === 'paid' || order.status === 'cancelled' || order.status === 'expired';
    return !paymentCanBeCompleted || !orderCanBeCompleted;
  }
  return payment.status !== 'pending' || order.status !== 'pending';
};

const bindWebhookPayment = async (transaction: Knex.Transaction, event: SumopodPaymentMutationEvent, values: WebhookPaymentValues, receivedAt: Date, reconcileAmounts: boolean): Promise<void> => {
  const { payment, order } = values;
  const target = getTargetStatuses(event);
  const paidAt = event.event_type === 'payment.completed' ? new Date(event.data.paid_at) : null;
  const settledAt = event.event_type === 'payment.completed' ? new Date(event.data.settled_at) : null;
  const completedAt = event.event_type === 'payment.completed' ? new Date(event.data.completed_at) : null;
  const fee = reconcileAmounts ? event.data.fee : order.fee_amount;
  const totalAmount = reconcileAmounts ? event.data.amount : order.total_amount;

  await updatePaymentFromWebhook(transaction, payment.id, order.id, {
    provider_reference: payment.provider_reference ?? event.data.payment_id,
    amount: reconcileAmounts ? event.data.amount : payment.amount,
    provider_fee_amount: reconcileAmounts ? event.data.fee : payment.provider_fee_amount!,
    provider_net_amount: reconcileAmounts ? event.data.net_amount : payment.provider_net_amount!,
    initiation_state: 'ready',
    payment_method: event.data.payment_method.toLowerCase(),
    status: target.paymentStatus,
    paid_at: paidAt,
    settled_at: settledAt,
    completed_at: completedAt,
    last_webhook_event_type: event.event_type,
    last_webhook_received_at: receivedAt,
  });

  await updateOrderFromWebhook(transaction, order.id, {
    fee_amount: fee,
    total_amount: totalAmount,
    status: target.orderStatus,
    paid_at: paidAt,
  });
};

export const processSumopodWebhook = async ({ event, receivedAt }: {
  readonly event: SumopodWebhookEvent;
  readonly receivedAt: Date;
}): Promise<{ readonly eventType: SumopodWebhookEvent['event_type']; readonly result: WebhookProcessingResult }> => {
  if (event.event_type === 'payment.test') {
    console.info('Sumopod test webhook received', { eventType: event.event_type });
    return { eventType: event.event_type, result: 'ignored' };
  }

  try {
    const result = await getDatabase().transaction(async (transaction) => {
      const values = await findLockedWebhookPayment(transaction, event);
      await validateWebhookReferences(transaction, event, values.payment);
      const reconcileAmounts = validateWebhookAmounts(event, values);

      if (isDuplicateEvent(event, values)) return 'duplicate';
      if (shouldIgnoreEvent(event, values)) return 'ignored';

      await bindWebhookPayment(transaction, event, values, receivedAt, reconcileAmounts);
      return 'processed';
    });
    return { eventType: event.event_type, result };
  } catch (error) {
    const candidate = error as { code?: string; constraint?: string };
    if (candidate.code === '23505' && candidate.constraint === 'payment_transactions_provider_reference_unique') {
      throw referenceMismatch();
    }
    throw error;
  }
};
