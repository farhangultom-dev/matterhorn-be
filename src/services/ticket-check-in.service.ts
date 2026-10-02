import type { Knex } from 'knex';
import { getDatabase } from '../config/database';
import { getTicketQrEnv } from '../config/env';
import { findCheckInEvent, hasEventCheckInAccess } from '../models/ticket-access.model';
import {
  findCheckInOrderForUpdate,
  findTicketCheckInReference,
  findTicketForCheckInUpdate,
  hasCompletedSumopodWebhookPayment,
  markTicketUsed,
} from '../models/ticket.model';
import { AppError } from '../utils/app-error';
import { verifyTicketQrPayload } from '../utils/ticket-qr';

export interface CheckedInTicket {
  readonly id: string;
  readonly eventId: string;
  readonly eventName: string;
  readonly ticketTypeName: string;
  readonly ticketNumber: number;
  readonly status: 'used';
  readonly usedAt: Date;
}

const unavailable = (): AppError => new AppError(409, 'EVENT_CHECK_IN_UNAVAILABLE', 'Event check-in is unavailable');
const invalidTicket = (): AppError => new AppError(409, 'TICKET_NOT_VALID', 'Ticket is not valid for check-in');

const getVerifiedTicketId = (qrPayload: string): string => {
  let key: Buffer;
  try {
    const qrEnv = getTicketQrEnv();
    if (!qrEnv.configured || qrEnv.secretKey.length !== 32) throw new Error('QR secret is unavailable');
    key = qrEnv.secretKey;
  } catch {
    throw new AppError(503, 'TICKET_QR_UNAVAILABLE', 'Ticket QR service is unavailable');
  }
  const ticketId = verifyTicketQrPayload(qrPayload, key);
  if (!ticketId) throw new AppError(400, 'INVALID_TICKET_QR', 'Ticket QR payload is invalid');
  return ticketId;
};

const readDatabaseNow = async (transaction: Knex.Transaction): Promise<Date> => {
  const result = await transaction.raw('select now() as now');
  return new Date(result.rows[0].now as Date);
};

export const checkInTicket = async ({ eventId, userId, qrPayload }: {
  readonly eventId: string;
  readonly userId: string;
  readonly qrPayload: string;
}): Promise<CheckedInTicket> => {
  const ticketId = getVerifiedTicketId(qrPayload);
  const database = getDatabase();

  return database.transaction(async (transaction) => {
    const event = await findCheckInEvent(transaction, eventId);
    if (!event) throw new AppError(404, 'EVENT_NOT_FOUND', 'Event not found');
    if (!(await hasEventCheckInAccess(transaction, eventId, userId))) {
      throw new AppError(403, 'FORBIDDEN', 'Role ID 1 or the event organizer is required');
    }

    const reference = await findTicketCheckInReference(transaction, ticketId, eventId);
    if (!reference) throw new AppError(404, 'TICKET_NOT_FOUND', 'Ticket not found for this event');

    const order = await findCheckInOrderForUpdate(transaction, reference.order_id);
    if (!order) throw new AppError(404, 'TICKET_NOT_FOUND', 'Ticket order not found');
    if (order.status !== 'paid' || !(await hasCompletedSumopodWebhookPayment(transaction, order.id))) throw invalidTicket();

    const ticket = await findTicketForCheckInUpdate(transaction, ticketId, eventId, order.id);
    if (!ticket) throw new AppError(404, 'TICKET_NOT_FOUND', 'Ticket not found for this event');
    if (ticket.status === 'used') throw new AppError(409, 'TICKET_ALREADY_USED', 'Ticket has already been used', [{ usedAt: ticket.used_at?.toISOString() ?? null }]);
    if (ticket.status !== 'issued' || ticket.qr_version !== 'v1' || ticket.order_status !== 'paid') {
      throw invalidTicket();
    }
    if (ticket.event_deleted_at !== null || ticket.organizer_deleted_at !== null) throw unavailable();

    const now = await readDatabaseNow(transaction);
    const startsAt = new Date(event.starts_at).getTime();
    const endsAt = new Date(event.ends_at).getTime();
    if (now.getTime() < startsAt - (2 * 60 * 60 * 1000) || now.getTime() >= endsAt) throw unavailable();

    const updatedTicket = await markTicketUsed(transaction, ticket.id, userId);
    if (!updatedTicket?.used_at) throw new AppError(409, 'TICKET_ALREADY_USED', 'Ticket has already been used');
    return {
      id: updatedTicket.id,
      eventId: ticket.event_id,
      eventName: ticket.event_title,
      ticketTypeName: ticket.ticket_type_name,
      ticketNumber: ticket.ticket_number,
      status: 'used',
      usedAt: updatedTicket.used_at,
    };
  });
};
