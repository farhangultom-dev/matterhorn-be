import type { Knex } from 'knex';

type Executor = Knex | Knex.Transaction;

export interface CheckoutEventRecord {
  readonly id: string;
  readonly visibility: 'public' | 'private';
  readonly deleted_at: Date | null;
  readonly starts_at: Date;
  readonly ends_at: Date;
  readonly registration_open_at: Date | null;
  readonly registration_close_at: Date | null;
  readonly capacity: number | null;
}

export interface CheckoutTicketRecord {
  readonly id: string;
  readonly event_id: string;
  readonly name: string;
  readonly price: number;
  readonly quota: number;
  readonly sales_start_at: Date;
  readonly sales_end_at: Date;
}

export interface PaymentOrderRecord {
  readonly id: string;
  readonly user_id: string;
  readonly checkout_key: string | null;
  readonly request_fingerprint: string | null;
  readonly subtotal_amount: number;
  readonly fee_amount: number;
  readonly total_amount: number;
  readonly status: 'pending' | 'paid' | 'cancelled' | 'expired' | 'refunded';
  readonly created_at: Date;
  readonly paid_at: Date | null;
  readonly updated_at: Date;
}

export interface PaymentOrderItemRecord {
  readonly id: string;
  readonly order_id: string;
  readonly event_ticket_type_id: string;
  readonly quantity: number;
  readonly unit_price: number;
  readonly subtotal: number;
  readonly created_at: Date;
}

export interface PaymentTransactionRecord {
  readonly id: number;
  readonly order_id: string;
  readonly provider: string;
  readonly provider_reference: string | null;
  readonly merchant_reference: string;
  readonly amount: number;
  readonly status: 'pending' | 'paid' | 'failed' | 'expired' | 'cancelled' | 'refunded';
  readonly expires_at: Date | null;
  readonly paid_at: Date | null;
  readonly cancelled_at: Date | null;
  readonly payment_link_url: string | null;
  readonly provider_fee_amount: number | null;
  readonly provider_net_amount: number | null;
  readonly initiation_state: 'processing' | 'ready' | 'unknown' | 'rejected' | null;
  readonly initiation_started_at: Date | null;
  readonly payment_method: string | null;
  readonly settled_at: Date | null;
  readonly completed_at: Date | null;
  readonly last_webhook_event_type: 'payment.completed' | 'payment.failed' | 'payment.expired' | null;
  readonly last_webhook_received_at: Date | null;
}

export interface WebhookOrderRecord {
  readonly id: string;
  readonly subtotal_amount: number;
  readonly fee_amount: number;
  readonly total_amount: number;
  readonly status: 'pending' | 'paid' | 'cancelled' | 'expired' | 'refunded';
  readonly paid_at: Date | null;
}

export interface IdempotentCheckoutRecord {
  readonly id: string;
  readonly request_fingerprint: string | null;
}

export const findOrderByCheckoutKey = async (executor: Executor, userId: string, checkoutKey: string): Promise<IdempotentCheckoutRecord | undefined> =>
  executor<IdempotentCheckoutRecord>('orders')
    .select('id', 'request_fingerprint')
    .where('user_id', userId)
    .andWhere('checkout_key', checkoutKey)
    .first();

export const findTicketEventIds = async (transaction: Knex.Transaction, ticketTypeIds: readonly string[]): Promise<readonly { id: string; event_id: string }[]> =>
  transaction('event_ticket_types')
    .select('id', 'event_id')
    .whereIn('id', ticketTypeIds)
    .orderBy('id', 'asc');

export const lockCheckoutEvent = async (transaction: Knex.Transaction, eventId: string): Promise<CheckoutEventRecord | undefined> =>
  transaction<CheckoutEventRecord>('events')
    .select('id', 'visibility', 'deleted_at', 'starts_at', 'ends_at', 'registration_open_at', 'registration_close_at', 'capacity')
    .where({ id: eventId })
    .forUpdate()
    .first();

export const lockCheckoutTicketTypes = async (transaction: Knex.Transaction, ticketTypeIds: readonly string[]): Promise<readonly CheckoutTicketRecord[]> =>
  transaction<CheckoutTicketRecord>('event_ticket_types')
    .select('id', 'event_id', 'name', 'price', 'quota', 'sales_start_at', 'sales_end_at')
    .whereIn('id', ticketTypeIds)
    .orderBy('id', 'asc')
    .forUpdate();

const heldOrderItems = (executor: Executor) => executor('order_items as oi')
  .join('orders as o', 'o.id', 'oi.order_id')
  .where((query) => query
    .where('o.status', 'paid')
    .orWhere((pending) => pending
      .where('o.status', 'pending')
      .whereExists(
        executor('payment_transactions as pt')
          .select('pt.id')
          .whereRaw('pt.order_id = o.id')
          .where('pt.status', 'pending')
          .andWhere((attempt) => attempt.whereNull('pt.initiation_state').orWhereIn('pt.initiation_state', ['processing', 'ready', 'unknown'])),
      )));

export const countHeldQuantitiesByTicketType = async (transaction: Knex.Transaction, ticketTypeIds: readonly string[]): Promise<ReadonlyMap<string, number>> => {
  if (ticketTypeIds.length === 0) return new Map();
  const rows = await heldOrderItems(transaction)
    .select('oi.event_ticket_type_id')
    .sum({ quantity: 'oi.quantity' })
    .groupBy('oi.event_ticket_type_id')
    .whereIn('oi.event_ticket_type_id', ticketTypeIds) as unknown as { event_ticket_type_id: string; quantity: string | number }[];
  return new Map(rows.map((row) => [row.event_ticket_type_id, Number(row.quantity)]));
};

export const countHeldEventQuantity = async (transaction: Knex.Transaction, eventId: string): Promise<number> => {
  const row = await heldOrderItems(transaction)
    .join('event_ticket_types as ett', 'ett.id', 'oi.event_ticket_type_id')
    .where('ett.event_id', eventId)
    .sum<{ quantity: string | number }>({ quantity: 'oi.quantity' })
    .first();
  return Number(row?.quantity ?? 0);
};

export const insertPaymentOrder = async (transaction: Knex.Transaction, values: {
  readonly id: string;
  readonly user_id: string;
  readonly checkout_key: string;
  readonly request_fingerprint: string;
  readonly subtotal_amount: number;
  readonly fee_amount: number;
  readonly total_amount: number;
}): Promise<void> => {
  await transaction('orders').insert(values);
};

export const insertPaymentOrderItems = async (transaction: Knex.Transaction, values: readonly {
  readonly id: string;
  readonly order_id: string;
  readonly event_ticket_type_id: string;
  readonly quantity: number;
  readonly unit_price: number;
  readonly subtotal: number;
}[]): Promise<void> => {
  await transaction('order_items').insert(values);
};

export const insertPaymentAttempt = async (transaction: Knex.Transaction, values: {
  readonly order_id: string;
  readonly provider: 'sumopod';
  readonly merchant_reference: string;
  readonly amount: number;
  readonly initiation_state: 'processing';
  readonly initiation_started_at: Date;
}): Promise<number> => {
  const rows = await transaction<PaymentTransactionRecord>('payment_transactions').insert(values).returning('id');
  const row = rows[0] as PaymentTransactionRecord | undefined;
  if (!row) throw new Error('Payment attempt insert did not return an ID.');
  return row.id;
};

export const findPaymentOrder = async (executor: Executor, orderId: string, userId?: string): Promise<PaymentOrderRecord | undefined> => {
  const query = executor<PaymentOrderRecord>('orders').select(
    'id', 'user_id', 'checkout_key', 'request_fingerprint', 'subtotal_amount', 'fee_amount', 'total_amount', 'status', 'created_at', 'paid_at', 'updated_at',
  ).where({ id: orderId });
  if (userId) query.andWhere({ user_id: userId });
  return query.first();
};

export const findPaymentOrderItems = async (executor: Executor, orderId: string): Promise<readonly PaymentOrderItemRecord[]> =>
  executor<PaymentOrderItemRecord>('order_items')
    .select('id', 'order_id', 'event_ticket_type_id', 'quantity', 'unit_price', 'subtotal', 'created_at')
    .where({ order_id: orderId })
    .orderBy('id', 'asc');

export const findLatestPaymentTransaction = async (executor: Executor, orderId: string): Promise<PaymentTransactionRecord | undefined> =>
  executor<PaymentTransactionRecord>('payment_transactions')
    .select(
      'id', 'order_id', 'provider', 'provider_reference', 'merchant_reference', 'amount', 'status', 'expires_at', 'paid_at', 'cancelled_at',
      'payment_link_url', 'provider_fee_amount', 'provider_net_amount', 'initiation_state', 'initiation_started_at',
      'payment_method', 'settled_at', 'completed_at', 'last_webhook_event_type', 'last_webhook_received_at',
    )
    .where({ order_id: orderId })
    .orderBy('id', 'desc')
    .first();

export const findPaymentTransactionForUpdate = async (transaction: Knex.Transaction, paymentId: number): Promise<PaymentTransactionRecord | undefined> =>
  transaction<PaymentTransactionRecord>('payment_transactions')
    .select(
      'id', 'order_id', 'provider', 'provider_reference', 'merchant_reference', 'amount', 'status', 'expires_at', 'paid_at', 'cancelled_at',
      'payment_link_url', 'provider_fee_amount', 'provider_net_amount', 'initiation_state', 'initiation_started_at',
      'payment_method', 'settled_at', 'completed_at', 'last_webhook_event_type', 'last_webhook_received_at',
    )
    .where({ id: paymentId })
    .forUpdate()
    .first();

export const findSumopodPaymentForUpdate = async (transaction: Knex.Transaction, merchantReference: string): Promise<PaymentTransactionRecord | undefined> =>
  transaction<PaymentTransactionRecord>('payment_transactions')
    .select(
      'id', 'order_id', 'provider', 'provider_reference', 'merchant_reference', 'amount', 'status', 'expires_at', 'paid_at', 'cancelled_at',
      'payment_link_url', 'provider_fee_amount', 'provider_net_amount', 'initiation_state', 'initiation_started_at',
      'payment_method', 'settled_at', 'completed_at', 'last_webhook_event_type', 'last_webhook_received_at',
    )
    .where({ provider: 'sumopod', merchant_reference: merchantReference })
    .forUpdate()
    .first();

export const findWebhookOrderForUpdate = async (transaction: Knex.Transaction, orderId: string): Promise<WebhookOrderRecord | undefined> =>
  transaction<WebhookOrderRecord>('orders')
    .select('id', 'subtotal_amount', 'fee_amount', 'total_amount', 'status', 'paid_at')
    .where({ id: orderId })
    .forUpdate()
    .first();

export const findOtherPaymentByProviderReference = async (transaction: Knex.Transaction, providerReference: string, paymentId: number): Promise<Pick<PaymentTransactionRecord, 'id'> | undefined> =>
  transaction<PaymentTransactionRecord>('payment_transactions')
    .select('id')
    .where({ provider_reference: providerReference })
    .whereNot({ id: paymentId })
    .first();

export const updatePaymentFromWebhook = async (transaction: Knex.Transaction, paymentId: number, orderId: string, values: {
  readonly provider_reference: string;
  readonly amount: number;
  readonly provider_fee_amount: number;
  readonly provider_net_amount: number;
  readonly initiation_state: 'ready';
  readonly payment_method: string;
  readonly status: 'paid' | 'failed' | 'expired';
  readonly paid_at: Date | null;
  readonly settled_at: Date | null;
  readonly completed_at: Date | null;
  readonly last_webhook_event_type: 'payment.completed' | 'payment.failed' | 'payment.expired';
  readonly last_webhook_received_at: Date;
}): Promise<void> => {
  const updatedCount = await transaction('payment_transactions')
    .where({ id: paymentId, order_id: orderId })
    .update(values);
  if (updatedCount !== 1) throw new Error('Webhook payment update did not affect one row.');
};

export const updateOrderFromWebhook = async (transaction: Knex.Transaction, orderId: string, values: {
  readonly fee_amount: number;
  readonly total_amount: number;
  readonly status: 'paid' | 'cancelled' | 'expired';
  readonly paid_at: Date | null;
}): Promise<void> => {
  const updatedCount = await transaction('orders').where({ id: orderId }).update({
    ...values,
    updated_at: transaction.fn.now(),
  });
  if (updatedCount !== 1) throw new Error('Webhook order update did not affect one row.');
};

export const markPaymentReady = async (transaction: Knex.Transaction, paymentId: number, orderId: string, values: {
  readonly amount: number;
  readonly provider_reference: string;
  readonly payment_link_url: string;
  readonly provider_fee_amount: number;
  readonly provider_net_amount: number;
  readonly expires_at: Date;
}): Promise<void> => {
  const updatedPaymentCount = await transaction('payment_transactions')
    .where({ id: paymentId, order_id: orderId })
    .update({ ...values, initiation_state: 'ready' });
  if (updatedPaymentCount !== 1) throw new Error('Payment attempt could not be finalized.');

  const updatedOrderCount = await transaction('orders')
    .where({ id: orderId })
    .update({
      fee_amount: values.provider_fee_amount,
      total_amount: values.amount,
      updated_at: transaction.fn.now(),
    });
  if (updatedOrderCount !== 1) throw new Error('Payment order could not be finalized.');
};

export const markPaymentUnknown = async (transaction: Knex.Transaction, paymentId: number): Promise<void> => {
  await transaction('payment_transactions').where({ id: paymentId }).whereIn('initiation_state', ['processing', 'unknown']).update({ initiation_state: 'unknown' });
};

export const markPaymentRejected = async (transaction: Knex.Transaction, paymentId: number): Promise<void> => {
  await transaction('payment_transactions').where({ id: paymentId }).update({ status: 'failed', initiation_state: 'rejected' });
};

export const isCheckoutKeyConflict = (error: unknown): boolean => {
  const candidate = error as { code?: string; constraint?: string };
  return candidate.code === '23505' && candidate.constraint === 'orders_user_id_checkout_key_unique';
};
