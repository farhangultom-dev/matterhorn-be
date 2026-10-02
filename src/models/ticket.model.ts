import type { Knex } from 'knex';

export type TicketStatus = 'issued' | 'used' | 'void';

export interface TicketIssuanceOrderRecord {
  readonly id: string;
  readonly status: string;
}

export interface TicketIssuanceItemRecord {
  readonly id: string;
  readonly event_ticket_type_id: string;
  readonly event_id: string;
  readonly quantity: number;
  readonly event_title: string;
  readonly ticket_type_name: string;
  readonly event_title_snapshot: string | null;
  readonly ticket_type_name_snapshot: string | null;
}

export interface EventTicketRecord {
  readonly id: string;
  readonly order_item_id: string;
  readonly event_id: string;
  readonly ticket_number: number;
  readonly status: TicketStatus;
  readonly qr_version: 'v1';
  readonly issued_at: Date;
  readonly used_at: Date | null;
  readonly used_by: string | null;
}

export interface OwnedTicketOrderRecord {
  readonly id: string;
  readonly user_id: string;
  readonly status: 'pending' | 'paid' | 'cancelled' | 'expired' | 'refunded';
}

export interface TicketViewRecord extends EventTicketRecord {
  readonly event_ticket_type_id: string;
  readonly event_title: string;
  readonly ticket_type_name: string;
  readonly event_deleted_at: Date | null;
  readonly organizer_deleted_at: Date | null;
  readonly ends_at: Date;
}

export interface TicketCheckInReference {
  readonly id: string;
  readonly order_id: string;
}

export interface CheckInOrderRecord {
  readonly id: string;
  readonly status: string;
}

export interface LockedTicketCheckInRecord extends TicketViewRecord {
  readonly order_id: string;
  readonly order_status: string;
}

type Executor = Knex | Knex.Transaction;

export const findOwnedTicketOrder = async (
  executor: Executor,
  orderId: string,
  userId: string,
): Promise<OwnedTicketOrderRecord | undefined> =>
  executor<OwnedTicketOrderRecord>('orders')
    .select('id', 'user_id', 'status')
    .where({ id: orderId, user_id: userId })
    .first();

export const findOrderItemsForTicketView = async (
  executor: Executor,
  orderId: string,
): Promise<readonly TicketIssuanceItemRecord[]> =>
  executor<TicketIssuanceItemRecord>('order_items as oi')
    .join('event_ticket_types as ett', 'ett.id', 'oi.event_ticket_type_id')
    .join('events as e', 'e.id', 'ett.event_id')
    .select(
      'oi.id', 'oi.event_ticket_type_id', 'ett.event_id', 'oi.quantity',
      'e.title as event_title', 'ett.name as ticket_type_name',
      'oi.event_title_snapshot', 'oi.ticket_type_name_snapshot',
    )
    .where('oi.order_id', orderId)
    .orderBy('oi.id', 'asc');

export const findTicketViewsForOrder = async (
  executor: Executor,
  orderId: string,
): Promise<readonly TicketViewRecord[]> =>
  executor<TicketViewRecord>('event_tickets as et')
    .join('order_items as oi', 'oi.id', 'et.order_item_id')
    .join('event_ticket_types as ett', 'ett.id', 'oi.event_ticket_type_id')
    .join('events as e', 'e.id', 'et.event_id')
    .join('organizers as org', 'org.id', 'e.organizer_id')
    .select(
      'et.id', 'et.order_item_id', 'et.event_id', 'et.ticket_number', 'et.status', 'et.qr_version',
      'et.issued_at', 'et.used_at', 'et.used_by', 'oi.event_ticket_type_id',
      executor.raw('coalesce(oi.event_title_snapshot, e.title) as event_title'),
      executor.raw('coalesce(oi.ticket_type_name_snapshot, ett.name) as ticket_type_name'),
      'e.deleted_at as event_deleted_at', 'org.deleted_at as organizer_deleted_at', 'e.ends_at',
    )
    .where('oi.order_id', orderId)
    .orderBy('et.order_item_id', 'asc')
    .orderBy('et.ticket_number', 'asc');

export const hasCompletedSumopodWebhookPayment = async (executor: Executor, orderId: string): Promise<boolean> => {
  const payment = await executor('payment_transactions')
    .select('id')
    .where({ order_id: orderId, provider: 'sumopod', status: 'paid', last_webhook_event_type: 'payment.completed' })
    .whereNotNull('provider_reference')
    .first();
  return payment !== undefined;
};

export const findTicketCheckInReference = async (
  executor: Executor,
  ticketId: string,
  eventId: string,
): Promise<TicketCheckInReference | undefined> =>
  executor<TicketCheckInReference>('event_tickets as et')
    .join('order_items as oi', 'oi.id', 'et.order_item_id')
    .select('et.id', 'oi.order_id')
    .where('et.id', ticketId)
    .andWhere('et.event_id', eventId)
    .first();

export const findCheckInOrderForUpdate = async (
  transaction: Knex.Transaction,
  orderId: string,
): Promise<CheckInOrderRecord | undefined> =>
  transaction<CheckInOrderRecord>('orders')
    .select('id', 'status')
    .where({ id: orderId })
    .forUpdate()
    .first();

export const findTicketForCheckInUpdate = async (
  transaction: Knex.Transaction,
  ticketId: string,
  eventId: string,
  orderId: string,
): Promise<LockedTicketCheckInRecord | undefined> =>
  transaction<LockedTicketCheckInRecord>('event_tickets as et')
    .join('order_items as oi', 'oi.id', 'et.order_item_id')
    .join('orders as o', 'o.id', 'oi.order_id')
    .join('event_ticket_types as ett', 'ett.id', 'oi.event_ticket_type_id')
    .join('events as e', 'e.id', 'et.event_id')
    .join('organizers as org', 'org.id', 'e.organizer_id')
    .select(
      'et.id', 'et.order_item_id', 'et.event_id', 'et.ticket_number', 'et.status', 'et.qr_version',
      'et.issued_at', 'et.used_at', 'et.used_by', 'oi.event_ticket_type_id', 'oi.order_id',
      'o.status as order_status',
      transaction.raw('coalesce(oi.event_title_snapshot, e.title) as event_title'),
      transaction.raw('coalesce(oi.ticket_type_name_snapshot, ett.name) as ticket_type_name'),
      'e.deleted_at as event_deleted_at', 'org.deleted_at as organizer_deleted_at', 'e.ends_at',
    )
    .where('et.id', ticketId)
    .andWhere('et.event_id', eventId)
    .andWhere('oi.order_id', orderId)
    .forUpdate('et')
    .first();

export const markTicketUsed = async (
  transaction: Knex.Transaction,
  ticketId: string,
  userId: string,
): Promise<EventTicketRecord | undefined> => {
  const rows = await transaction<EventTicketRecord>('event_tickets')
    .where({ id: ticketId, status: 'issued' })
    .update({ status: 'used', used_at: transaction.fn.now(), used_by: userId })
    .returning(['id', 'order_item_id', 'event_id', 'ticket_number', 'status', 'qr_version', 'issued_at', 'used_at', 'used_by']);
  return rows[0];
};

export const findTicketIssuanceOrder = async (transaction: Knex.Transaction, orderId: string): Promise<TicketIssuanceOrderRecord | undefined> =>
  transaction<TicketIssuanceOrderRecord>('orders')
    .select('id', 'status')
    .where({ id: orderId })
    .first();

export const findTicketIssuanceItems = async (transaction: Knex.Transaction, orderId: string): Promise<readonly TicketIssuanceItemRecord[]> =>
  transaction<TicketIssuanceItemRecord>('order_items as oi')
    .join('event_ticket_types as ett', 'ett.id', 'oi.event_ticket_type_id')
    .join('events as e', 'e.id', 'ett.event_id')
    .select(
      'oi.id',
      'oi.event_ticket_type_id',
      'ett.event_id',
      'oi.quantity',
      'e.title as event_title',
      'ett.name as ticket_type_name',
      'oi.event_title_snapshot',
      'oi.ticket_type_name_snapshot',
    )
    .where('oi.order_id', orderId)
    .orderBy('oi.id', 'asc');

export const fillTicketIssuanceSnapshots = async (
  transaction: Knex.Transaction,
  item: TicketIssuanceItemRecord,
): Promise<void> => {
  await transaction('order_items')
    .where({ id: item.id })
    .update({
      event_title_snapshot: transaction.raw('coalesce(??, ?)', ['event_title_snapshot', item.event_title_snapshot ?? item.event_title]),
      ticket_type_name_snapshot: transaction.raw('coalesce(??, ?)', ['ticket_type_name_snapshot', item.ticket_type_name_snapshot ?? item.ticket_type_name]),
    });
};

export const findEventTicketsForItems = async (
  transaction: Knex.Transaction,
  orderItemIds: readonly string[],
): Promise<readonly EventTicketRecord[]> => {
  if (orderItemIds.length === 0) return [];
  return transaction<EventTicketRecord>('event_tickets')
    .select('id', 'order_item_id', 'event_id', 'ticket_number', 'status', 'qr_version', 'issued_at', 'used_at', 'used_by')
    .whereIn('order_item_id', orderItemIds)
    .orderBy('order_item_id', 'asc')
    .orderBy('ticket_number', 'asc');
};

export const insertEventTicketsIfMissing = async (
  transaction: Knex.Transaction,
  values: readonly {
    readonly id: string;
    readonly order_item_id: string;
    readonly event_id: string;
    readonly ticket_number: number;
    readonly status: 'issued';
    readonly qr_version: 'v1';
  }[],
): Promise<number> => {
  if (values.length === 0) return 0;
  const rows = await transaction('event_tickets')
    .insert(values)
    .onConflict(['order_item_id', 'ticket_number'])
    .ignore()
    .returning('id');
  return rows.length;
};
