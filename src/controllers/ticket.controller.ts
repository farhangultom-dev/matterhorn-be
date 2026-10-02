import type { RequestHandler } from 'express';
import { getOwnedOrderTickets } from '../services/ticket.service';
import { checkInTicket } from '../services/ticket-check-in.service';
import type { EventIdParams } from '../validations/event.validation';
import type { PaymentOrderParams } from '../validations/payment.validation';
import type { TicketQrPayloadInput } from '../validations/ticket.validation';
import { successResponse } from '../views/response.view';

const toIso = (value: Date | null): string | null => value === null ? null : new Date(value).toISOString();

export const getOrderTicketsController: RequestHandler = async (request, response) => {
  response.setHeader('Cache-Control', 'private, no-store');
  const { orderId } = response.locals.validatedParams as PaymentOrderParams;
  const result = await getOwnedOrderTickets({ orderId, userId: request.auth!.userId });
  response.json(successResponse('Order tickets retrieved', {
    orderId: result.orderId,
    orderStatus: result.orderStatus,
    issuanceStatus: result.issuanceStatus,
    expectedTicketCount: result.expectedTicketCount,
    ticketCount: result.ticketCount,
    tickets: result.tickets.map((ticket) => ({
      id: ticket.id,
      orderItemId: ticket.orderItemId,
      eventId: ticket.eventId,
      eventTicketTypeId: ticket.eventTicketTypeId,
      eventName: ticket.eventName,
      ticketTypeName: ticket.ticketTypeName,
      ticketNumber: ticket.ticketNumber,
      status: ticket.status,
      issuedAt: ticket.issuedAt.toISOString(),
      usedAt: toIso(ticket.usedAt),
      qrPayload: ticket.qrPayload,
    })),
  }));
};

export const checkInTicketController: RequestHandler = async (request, response) => {
  const { eventId } = response.locals.validatedParams as EventIdParams;
  const { qrPayload } = response.locals.validatedBody as TicketQrPayloadInput;
  const ticket = await checkInTicket({ eventId, userId: request.auth!.userId, qrPayload });
  response.json(successResponse('Ticket checked in', {
    ticket: {
      id: ticket.id,
      eventId: ticket.eventId,
      eventName: ticket.eventName,
      ticketTypeName: ticket.ticketTypeName,
      ticketNumber: ticket.ticketNumber,
      status: ticket.status,
      usedAt: ticket.usedAt.toISOString(),
    },
  }));
};
