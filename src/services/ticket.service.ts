import { getDatabase } from '../config/database';
import { getTicketQrEnv } from '../config/env';
import {
  findOrderItemsForTicketView,
  findOwnedTicketOrder,
  findTicketViewsForOrder,
  hasCompletedSumopodWebhookPayment,
  type TicketStatus,
  type TicketViewRecord,
} from '../models/ticket.model';
import { AppError } from '../utils/app-error';
import { createTicketQrPayload } from '../utils/ticket-qr';

export interface OrderTicketView {
  readonly id: string;
  readonly orderItemId: string;
  readonly eventId: string;
  readonly eventTicketTypeId: string;
  readonly eventName: string;
  readonly ticketTypeName: string;
  readonly ticketNumber: number;
  readonly status: TicketStatus;
  readonly issuedAt: Date;
  readonly usedAt: Date | null;
  readonly qrPayload: string | null;
}

export interface OrderTicketsResult {
  readonly orderId: string;
  readonly orderStatus: string;
  readonly issuanceStatus: 'ready' | 'not_eligible' | 'not_issued';
  readonly expectedTicketCount: number;
  readonly ticketCount: number;
  readonly tickets: readonly OrderTicketView[];
}

const ticketsUnavailable = (): AppError => new AppError(503, 'TICKET_QR_UNAVAILABLE', 'Ticket QR service is unavailable');

const isCompleteIssuance = (items: readonly { id: string; event_id: string; quantity: number }[], tickets: readonly TicketViewRecord[]): boolean => {
  if (items.length === 0) return false;
  const ticketsByItem = new Map<string, TicketViewRecord[]>();
  for (const ticket of tickets) {
    const group = ticketsByItem.get(ticket.order_item_id) ?? [];
    group.push(ticket);
    ticketsByItem.set(ticket.order_item_id, group);
  }
  return items.every((item) => {
    const itemTickets = ticketsByItem.get(item.id) ?? [];
    const numbers = new Set(itemTickets.map((ticket) => ticket.ticket_number));
    return itemTickets.length === item.quantity
      && numbers.size === item.quantity
      && itemTickets.every((ticket) => ticket.event_id === item.event_id
        && ticket.ticket_number >= 1
        && ticket.ticket_number <= item.quantity
        && ['issued', 'used', 'void'].includes(ticket.status)
        && ticket.qr_version === 'v1');
  });
};

const isAvailableForDisplay = (ticket: TicketViewRecord, now: Date): boolean =>
  ticket.status === 'issued'
  && ticket.event_deleted_at === null
  && ticket.organizer_deleted_at === null
  && new Date(ticket.ends_at).getTime() > now.getTime();

export const getOwnedOrderTickets = async ({ orderId, userId }: {
  readonly orderId: string;
  readonly userId: string;
}): Promise<OrderTicketsResult> => {
  const database = getDatabase();
  const order = await findOwnedTicketOrder(database, orderId, userId);
  if (!order) throw new AppError(404, 'ORDER_NOT_FOUND', 'Order not found');

  const items = await findOrderItemsForTicketView(database, orderId);
  const expectedTicketCount = items.reduce((total, item) => total + item.quantity, 0);
  if (!Number.isSafeInteger(expectedTicketCount)) {
    throw new AppError(500, 'TICKET_ISSUANCE_INCONSISTENT', 'Tickets could not be read consistently for this order');
  }

  if (order.status !== 'paid') {
    return { orderId, orderStatus: order.status, issuanceStatus: 'not_eligible', expectedTicketCount, ticketCount: 0, tickets: [] };
  }

  const [ticketRows, hasPaidPayment] = await Promise.all([
    findTicketViewsForOrder(database, orderId),
    hasCompletedSumopodWebhookPayment(database, orderId),
  ]);
  const isReady = hasPaidPayment && isCompleteIssuance(items, ticketRows);
  const timeResult = isReady ? await database.raw('select now() as now') : undefined;
  const databaseNow = timeResult ? new Date(timeResult.rows[0].now as Date) : undefined;
  let secretKey: Buffer | undefined;
  if (isReady && databaseNow && ticketRows.some((ticket) => isAvailableForDisplay(ticket, databaseNow))) {
    try {
      const qrEnv = getTicketQrEnv();
      if (!qrEnv.configured || qrEnv.secretKey.length !== 32) throw ticketsUnavailable();
      secretKey = qrEnv.secretKey;
    } catch {
      throw ticketsUnavailable();
    }
  }

  const tickets = ticketRows.map((ticket): OrderTicketView => ({
    id: ticket.id,
    orderItemId: ticket.order_item_id,
    eventId: ticket.event_id,
    eventTicketTypeId: ticket.event_ticket_type_id,
    eventName: ticket.event_title,
    ticketTypeName: ticket.ticket_type_name,
    ticketNumber: ticket.ticket_number,
    status: ticket.status,
    issuedAt: ticket.issued_at,
    usedAt: ticket.used_at,
    qrPayload: isReady && secretKey && databaseNow && isAvailableForDisplay(ticket, databaseNow)
      ? createTicketQrPayload(ticket.id, secretKey)
      : null,
  }));

  return {
    orderId,
    orderStatus: order.status,
    issuanceStatus: isReady ? 'ready' : 'not_issued',
    expectedTicketCount,
    ticketCount: tickets.length,
    tickets,
  };
};
