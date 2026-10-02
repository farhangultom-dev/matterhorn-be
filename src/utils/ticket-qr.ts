import { createHmac, timingSafeEqual } from 'node:crypto';

const TICKET_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const QR_PAYLOAD_PATTERN = /^mh-ticket:v1:([0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}):([0-9a-f]{64})$/;
const QR_PAYLOAD_LENGTH = 114;

export const createTicketQrPayload = (ticketId: string, secretKey: Buffer): string => {
  const normalizedId = ticketId.toLowerCase();
  if (!TICKET_ID_PATTERN.test(normalizedId) || secretKey.length !== 32) {
    throw new Error('Ticket QR payload cannot be created from invalid input.');
  }
  const unsignedPayload = `mh-ticket:v1:${normalizedId}`;
  const signature = createHmac('sha256', secretKey).update(unsignedPayload, 'utf8').digest('hex');
  return `${unsignedPayload}:${signature}`;
};

export const verifyTicketQrPayload = (payload: string, secretKey: Buffer): string | undefined => {
  if (payload.length !== QR_PAYLOAD_LENGTH || secretKey.length !== 32) return undefined;
  const match = QR_PAYLOAD_PATTERN.exec(payload);
  if (!match) return undefined;

  const ticketId = match[1]!;
  const signature = Buffer.from(match[2]!, 'hex');
  const unsignedPayload = `mh-ticket:v1:${ticketId}`;
  const expectedSignature = createHmac('sha256', secretKey).update(unsignedPayload, 'utf8').digest();
  if (signature.length !== expectedSignature.length || !timingSafeEqual(signature, expectedSignature)) return undefined;
  return ticketId;
};
