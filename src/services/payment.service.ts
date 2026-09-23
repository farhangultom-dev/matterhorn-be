import { createHash, randomUUID } from 'node:crypto';
import { getDatabase } from '../config/database';
import { getSumopodEnv } from '../config/env';
import {
  countHeldEventQuantity,
  countHeldQuantitiesByTicketType,
  findLatestPaymentTransaction,
  findOrderByCheckoutKey,
  findPaymentOrder,
  findPaymentOrderItems,
  findPaymentTransactionForUpdate,
  findTicketEventIds,
  insertPaymentAttempt,
  insertPaymentOrder,
  insertPaymentOrderItems,
  isCheckoutKeyConflict,
  lockCheckoutEvent,
  lockCheckoutTicketTypes,
  markPaymentReady,
  markPaymentRejected,
  markPaymentUnknown,
  type PaymentOrderItemRecord,
  type PaymentOrderRecord,
  type PaymentTransactionRecord,
} from '../models/payment.model';
import type { CreatePaymentInput } from '../validations/payment.validation';
import { AppError } from '../utils/app-error';
import { createSumopodPayment, SumopodConfigurationError, SumopodOutcomeUnknownError, SumopodRejectedError } from './sumopod.service';

const MAX_POSTGRES_INTEGER = 2_147_483_647;

export interface PaymentCheckout {
  readonly order: PaymentOrderRecord;
  readonly items: readonly PaymentOrderItemRecord[];
  readonly payment: PaymentTransactionRecord;
}

interface CreatedPaymentAttempt {
  readonly orderId: string;
  readonly paymentId: number;
  readonly amount: number;
  readonly isReplay: boolean;
}

type ExistingCheckoutResult = { readonly statusCode: 200 | 202; readonly checkout?: PaymentCheckout; readonly pendingOrderId?: string; readonly pendingInitiationStatus?: 'processing' | 'unknown' };

const requestFingerprint = (input: CreatePaymentInput): string => {
  const normalized = {
    items: [...input.items]
      .map((item) => ({ eventTicketTypeId: item.eventTicketTypeId.toLowerCase(), quantity: item.quantity }))
      .sort((left, right) => left.eventTicketTypeId.localeCompare(right.eventTicketTypeId)),
    expiresInHours: input.expiresInHours ?? null,
    paymentMethodTypeCode: input.paymentMethodTypeCode ?? null,
  };
  return createHash('sha256').update(JSON.stringify(normalized)).digest('hex');
};

const loadCheckout = async (orderId: string, userId?: string): Promise<PaymentCheckout> => {
  const database = getDatabase();
  const order = await findPaymentOrder(database, orderId, userId);
  if (!order) throw new AppError(404, 'ORDER_NOT_FOUND', 'Order not found');
  const [items, payment] = await Promise.all([
    findPaymentOrderItems(database, order.id),
    findLatestPaymentTransaction(database, order.id),
  ]);
  if (!payment) throw new AppError(500, 'INTERNAL_SERVER_ERROR', 'Payment record is unavailable');
  return { order, items, payment };
};

const assertSumopodConfiguration = (): void => {
  try {
    if (!getSumopodEnv().configured) throw new Error('Missing gateway configuration');
  } catch {
    throw new AppError(503, 'PAYMENT_GATEWAY_UNAVAILABLE', 'Payment gateway is unavailable');
  }
};

const respondToExistingCheckout = async ({ orderId, userId, fingerprint }: { orderId: string; userId: string; fingerprint: string }): Promise<ExistingCheckoutResult> => {
  const checkout = await loadCheckout(orderId, userId);
  if (checkout.order.request_fingerprint !== fingerprint) {
    throw new AppError(409, 'IDEMPOTENCY_KEY_REUSED', 'Idempotency key was already used for a different checkout');
  }
  if (checkout.payment.initiation_state === 'rejected') {
    throw new AppError(502, 'PAYMENT_GATEWAY_REJECTED', 'Payment provider rejected the request');
  }
  if (checkout.payment.initiation_state === 'processing' || checkout.payment.initiation_state === 'unknown') {
    return { statusCode: 202, pendingOrderId: orderId, pendingInitiationStatus: checkout.payment.initiation_state };
  }
  return { statusCode: 200, checkout };
};

const savePaymentUnknown = async (paymentId: number): Promise<void> => {
  try {
    await getDatabase().transaction(async (transaction) => {
      const current = await findPaymentTransactionForUpdate(transaction, paymentId);
      if (current?.initiation_state === 'processing' || current?.initiation_state === 'unknown') {
        await markPaymentUnknown(transaction, paymentId);
      }
    });
  } catch {
    // The durable processing record remains visible if the database is unavailable.
  }
};

const resolveExistingKey = async (userId: string, key: string, fingerprint: string): Promise<ExistingCheckoutResult | undefined> => {
  const existing = await findOrderByCheckoutKey(getDatabase(), userId, key);
  if (!existing) return undefined;
  return respondToExistingCheckout({ orderId: existing.id, userId, fingerprint });
};

export const createPaymentCheckout = async ({ userId, checkoutKey, input }: { userId: string; checkoutKey: string; input: CreatePaymentInput }): Promise<{ statusCode: 200 | 201 | 202; checkout?: PaymentCheckout; pendingOrderId?: string; pendingInitiationStatus?: 'processing' | 'unknown' }> => {
  const fingerprint = requestFingerprint(input);
  const existing = await resolveExistingKey(userId, checkoutKey, fingerprint);
  if (existing) return existing;
  assertSumopodConfiguration();

  const ticketTypeIds = input.items.map((item) => item.eventTicketTypeId);
  let created: CreatedPaymentAttempt;
  try {
    created = await getDatabase().transaction(async (transaction) => {
      const existingBeforeLock = await findOrderByCheckoutKey(transaction, userId, checkoutKey);
      if (existingBeforeLock) return { orderId: existingBeforeLock.id, paymentId: 0, amount: 0, isReplay: true };

      const ticketReferences = await findTicketEventIds(transaction, ticketTypeIds);
      if (ticketReferences.length !== ticketTypeIds.length) throw new AppError(400, 'TICKET_UNAVAILABLE', 'One or more ticket types are unavailable');
      const eventIds = new Set(ticketReferences.map((ticket) => ticket.event_id));
      if (eventIds.size !== 1) throw new AppError(400, 'TICKET_UNAVAILABLE', 'All ticket types must belong to one event');
      const eventId = ticketReferences[0]!.event_id;

      const event = await lockCheckoutEvent(transaction, eventId);
      if (!event || event.deleted_at !== null || event.visibility !== 'public') {
        throw new AppError(400, 'TICKET_UNAVAILABLE', 'Event is unavailable for checkout');
      }
      const existingAfterLock = await findOrderByCheckoutKey(transaction, userId, checkoutKey);
      if (existingAfterLock) return { orderId: existingAfterLock.id, paymentId: 0, amount: 0, isReplay: true };

      const ticketTypes = await lockCheckoutTicketTypes(transaction, ticketTypeIds);
      if (ticketTypes.length !== ticketTypeIds.length || ticketTypes.some((ticket) => ticket.event_id !== eventId)) {
        throw new AppError(400, 'TICKET_UNAVAILABLE', 'One or more ticket types are unavailable');
      }

      const nowResult = await transaction.raw('select now() as now');
      const now = new Date(nowResult.rows[0].now as Date);
      if (event.ends_at.getTime() <= now.getTime()
        || (event.registration_open_at !== null && event.registration_open_at.getTime() > now.getTime())
        || (event.registration_close_at !== null && event.registration_close_at.getTime() <= now.getTime())) {
        throw new AppError(400, 'TICKET_UNAVAILABLE', 'Event registration is not open');
      }
      if (ticketTypes.some((ticket) => ticket.sales_start_at.getTime() > now.getTime() || ticket.sales_end_at.getTime() <= now.getTime())) {
        throw new AppError(400, 'TICKET_UNAVAILABLE', 'One or more ticket types are outside their sales window');
      }

      const ticketById = new Map(ticketTypes.map((ticket) => [ticket.id, ticket]));
      let subtotalAmount = 0;
      const itemValues = input.items.map((item) => {
        const ticket = ticketById.get(item.eventTicketTypeId);
        if (!ticket) throw new AppError(400, 'TICKET_UNAVAILABLE', 'One or more ticket types are unavailable');
        const subtotal = ticket.price * item.quantity;
        if (!Number.isSafeInteger(subtotal) || subtotal > MAX_POSTGRES_INTEGER) throw new AppError(400, 'VALIDATION_ERROR', 'Checkout amount is too large');
        subtotalAmount += subtotal;
        return {
          id: randomUUID(),
          order_id: '',
          event_ticket_type_id: ticket.id,
          quantity: item.quantity,
          unit_price: ticket.price,
          subtotal,
        };
      });
      if (!Number.isSafeInteger(subtotalAmount) || subtotalAmount > MAX_POSTGRES_INTEGER) throw new AppError(400, 'VALIDATION_ERROR', 'Checkout amount is too large');
      if (subtotalAmount <= 0) throw new AppError(400, 'VALIDATION_ERROR', 'Free checkout is not supported by the payment endpoint');

      const heldByTicket = await countHeldQuantitiesByTicketType(transaction, ticketTypeIds);
      for (const item of input.items) {
        const ticket = ticketById.get(item.eventTicketTypeId)!;
        if ((heldByTicket.get(ticket.id) ?? 0) + item.quantity > ticket.quota) {
          throw new AppError(409, 'TICKET_SOLD_OUT', 'Requested ticket quantity is no longer available');
        }
      }
      if (event.capacity !== null) {
        const heldForEvent = await countHeldEventQuantity(transaction, event.id);
        const requestedForEvent = input.items.reduce((total, item) => total + item.quantity, 0);
        if (heldForEvent + requestedForEvent > event.capacity) throw new AppError(409, 'TICKET_SOLD_OUT', 'Event capacity has been reached');
      }

      const orderId = randomUUID();
      const merchantReference = 'MH-' + orderId;
      await insertPaymentOrder(transaction, {
        id: orderId,
        user_id: userId,
        checkout_key: checkoutKey,
        request_fingerprint: fingerprint,
        subtotal_amount: subtotalAmount,
        fee_amount: 0,
        total_amount: subtotalAmount,
      });
      await insertPaymentOrderItems(transaction, itemValues.map((item) => ({ ...item, order_id: orderId })));
      const paymentId = await insertPaymentAttempt(transaction, {
        order_id: orderId,
        provider: 'sumopod',
        merchant_reference: merchantReference,
        amount: subtotalAmount,
        initiation_state: 'processing',
        initiation_started_at: now,
      });
      return { orderId, paymentId, amount: subtotalAmount, isReplay: false };
    });
  } catch (error) {
    if (!isCheckoutKeyConflict(error)) throw error;
    const raced = await resolveExistingKey(userId, checkoutKey, fingerprint);
    if (raced) return raced;
    throw error;
  }

  if (created.isReplay) {
    const replay = await respondToExistingCheckout({ orderId: created.orderId, userId, fingerprint });
    return replay;
  }

  const merchantReference = 'MH-' + created.orderId;
  try {
    const providerPayment = await createSumopodPayment({
      orderId: created.orderId,
      amount: created.amount,
      ...(input.expiresInHours === undefined ? {} : { expiresInHours: input.expiresInHours }),
      ...(input.paymentMethodTypeCode === undefined ? {} : { paymentMethodTypeCode: input.paymentMethodTypeCode }),
    });
    if (providerPayment.order_id !== merchantReference || providerPayment.net_amount !== created.amount) {
      throw new SumopodOutcomeUnknownError('Sumopod response did not match the submitted payment');
    }
    const expiresAt = new Date(providerPayment.expires_at);
    // A successful provider response is authoritative for initiation. Persist and
    // return its link even if the provider's expiry timestamp is already past;
    // the expiry value is still exposed so the client can treat it as expired.
    if (!Number.isFinite(expiresAt.getTime())) throw new SumopodOutcomeUnknownError('Sumopod returned an invalid expiry timestamp');
    await getDatabase().transaction(async (transaction) => {
      const current = await findPaymentTransactionForUpdate(transaction, created.paymentId);
      if (!current || current.initiation_state !== 'processing') throw new SumopodOutcomeUnknownError('Payment attempt changed before provider response was saved');
      await markPaymentReady(transaction, created.paymentId, created.orderId, {
        amount: providerPayment.amount,
        provider_reference: providerPayment.payment_id,
        payment_link_url: providerPayment.payment_link_url,
        provider_fee_amount: providerPayment.fee,
        provider_net_amount: providerPayment.net_amount,
        expires_at: expiresAt,
      });
    });
    return { statusCode: 201, checkout: await loadCheckout(created.orderId, userId) };
  } catch (error) {
    if (error instanceof SumopodConfigurationError) {
      throw new AppError(503, 'PAYMENT_GATEWAY_UNAVAILABLE', 'Payment gateway is unavailable');
    }
    if (error instanceof SumopodRejectedError) {
      try {
        await getDatabase().transaction(async (transaction) => {
          const current = await findPaymentTransactionForUpdate(transaction, created.paymentId);
          if (current) await markPaymentRejected(transaction, created.paymentId);
        });
      } catch {
        await savePaymentUnknown(created.paymentId);
        return { statusCode: 202, pendingOrderId: created.orderId, pendingInitiationStatus: 'unknown' };
      }
      console.error('Sumopod rejected payment request', { orderId: created.orderId, statusCode: error.statusCode });
      throw new AppError(502, 'PAYMENT_GATEWAY_REJECTED', 'Payment provider rejected the request');
    }
    await savePaymentUnknown(created.paymentId);
    console.error('Sumopod payment initiation outcome is unknown', {
      orderId: created.orderId,
      category: error instanceof Error ? error.name : 'UnknownError',
    });
    return { statusCode: 202, pendingOrderId: created.orderId, pendingInitiationStatus: 'unknown' };
  }
};

export const getOwnedPaymentCheckout = async ({ orderId, userId }: { orderId: string; userId: string }): Promise<PaymentCheckout> =>
  loadCheckout(orderId, userId);
