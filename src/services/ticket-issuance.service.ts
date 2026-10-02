import { randomUUID } from 'node:crypto';
import type { Knex } from 'knex';
import {
  fillTicketIssuanceSnapshots,
  findEventTicketsForItems,
  findTicketIssuanceItems,
  findTicketIssuanceOrder,
  insertEventTicketsIfMissing,
} from '../models/ticket.model';
import { AppError } from '../utils/app-error';

export interface TicketIssuanceResult {
  readonly expectedCount: number;
  readonly createdCount: number;
  readonly existingCount: number;
}

const inconsistentIssuance = (): AppError => new AppError(
  500,
  'TICKET_ISSUANCE_INCONSISTENT',
  'Tickets could not be issued consistently for this order',
);

/** Ensure one stable ticket row exists for every purchased unit of a paid order. */
export const ensureOrderTickets = async (
  transaction: Knex.Transaction,
  orderId: string,
): Promise<TicketIssuanceResult> => {
  const order = await findTicketIssuanceOrder(transaction, orderId);
  if (!order || order.status !== 'paid') throw inconsistentIssuance();

  const items = await findTicketIssuanceItems(transaction, orderId);
  if (items.length === 0 || items.some((item) => !Number.isSafeInteger(item.quantity) || item.quantity < 1)) {
    throw inconsistentIssuance();
  }

  const eventIds = new Set(items.map((item) => item.event_id));
  if (eventIds.size !== 1) throw inconsistentIssuance();

  for (const item of items) await fillTicketIssuanceSnapshots(transaction, item);

  const existingTickets = await findEventTicketsForItems(transaction, items.map((item) => item.id));
  const ticketsByItemId = new Map<string, typeof existingTickets[number][]>();
  for (const ticket of existingTickets) {
    const itemTickets = ticketsByItemId.get(ticket.order_item_id) ?? [];
    itemTickets.push(ticket);
    ticketsByItemId.set(ticket.order_item_id, itemTickets);
  }

  const newTickets: {
    id: string;
    order_item_id: string;
    event_id: string;
    ticket_number: number;
    status: 'issued';
    qr_version: 'v1';
  }[] = [];
  let expectedCount = 0;

  for (const item of items) {
    expectedCount += item.quantity;
    if (!Number.isSafeInteger(expectedCount)) throw inconsistentIssuance();
    const itemTickets = ticketsByItemId.get(item.id) ?? [];
    const ticketNumbers = new Set<number>();
    for (const ticket of itemTickets) {
      if (ticket.event_id !== item.event_id
        || ticket.ticket_number < 1
        || ticket.ticket_number > item.quantity
        || ticketNumbers.has(ticket.ticket_number)
        || ticket.qr_version !== 'v1'
        || !['issued', 'used', 'void'].includes(ticket.status)) {
        throw inconsistentIssuance();
      }
      ticketNumbers.add(ticket.ticket_number);
    }

    for (let ticketNumber = 1; ticketNumber <= item.quantity; ticketNumber += 1) {
      if (!ticketNumbers.has(ticketNumber)) {
        newTickets.push({
          id: randomUUID(),
          order_item_id: item.id,
          event_id: item.event_id,
          ticket_number: ticketNumber,
          status: 'issued',
          qr_version: 'v1',
        });
      }
    }
  }

  const insertedCount = await insertEventTicketsIfMissing(transaction, newTickets);
  const ticketsAfterInsert = await findEventTicketsForItems(transaction, items.map((item) => item.id));
  const itemsById = new Map(items.map((item) => [item.id, item]));
  const verifiedNumbersByItem = new Map<string, Set<number>>();

  for (const ticket of ticketsAfterInsert) {
    const item = itemsById.get(ticket.order_item_id);
    const numbers = verifiedNumbersByItem.get(ticket.order_item_id) ?? new Set<number>();
    if (!item || ticket.event_id !== item.event_id || ticket.ticket_number < 1 || ticket.ticket_number > item.quantity
      || numbers.has(ticket.ticket_number) || ticket.qr_version !== 'v1') {
      throw inconsistentIssuance();
    }
    numbers.add(ticket.ticket_number);
    verifiedNumbersByItem.set(ticket.order_item_id, numbers);
  }

  const allItemsHaveExpectedTickets = items.every((item) => {
    const numbers = verifiedNumbersByItem.get(item.id);
    return numbers?.size === item.quantity;
  });
  if (ticketsAfterInsert.length !== expectedCount || !allItemsHaveExpectedTickets) throw inconsistentIssuance();

  return {
    expectedCount,
    createdCount: insertedCount,
    existingCount: ticketsAfterInsert.length - insertedCount,
  };
};
