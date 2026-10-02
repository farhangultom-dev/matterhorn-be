import { z } from 'zod';

export const ticketQrPayloadSchema = z.object({
  qrPayload: z.string().min(1).max(200),
}).strict();

export type TicketQrPayloadInput = z.infer<typeof ticketQrPayloadSchema>;
