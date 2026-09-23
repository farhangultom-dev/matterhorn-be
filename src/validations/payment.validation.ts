import { z } from 'zod';

const httpsUrl = z.string().url().refine((value) => {
  const parsed = new URL(value);
  return parsed.protocol === 'https:' && !parsed.username && !parsed.password;
}, 'URL must use HTTPS and must not contain credentials');

export const createPaymentSchema = z.object({
  items: z.array(z.object({
    eventTicketTypeId: z.string().uuid(),
    quantity: z.number().int().min(1).max(20),
  }).strict()).min(1).max(20),
  expiresInHours: z.number().int().min(1).max(24).optional(),
  paymentMethodTypeCode: z.string().trim().regex(/^[A-Z0-9_-]{1,50}$/).optional(),
}).strict().superRefine((value, context) => {
  const ticketTypeIds = value.items.map((item) => item.eventTicketTypeId);
  if (new Set(ticketTypeIds).size !== ticketTypeIds.length) {
    context.addIssue({ code: 'custom', path: ['items'], message: 'eventTicketTypeId values must be unique' });
  }
});

export const createPaymentHeadersSchema = z.object({
  idempotencyKey: z.string().uuid(),
}).strict();

export const paymentOrderParamsSchema = z.object({
  orderId: z.string().uuid(),
}).strict();

export const sumopodPaymentResponseSchema = z.object({
  payment_id: z.string().trim().min(1).max(150),
  order_id: z.string().trim().min(1).max(150),
  amount: z.number().int().positive().max(2_147_483_647),
  fee: z.number().int().min(0).max(2_147_483_647),
  net_amount: z.number().int().min(0).max(2_147_483_647),
  payment_link_url: httpsUrl,
  status: z.literal('pending'),
  expires_at: z.string().datetime({ offset: true }),
}).superRefine((value, context) => {
  if (value.fee > value.amount || value.net_amount !== value.amount - value.fee) {
    context.addIssue({ code: 'custom', path: ['net_amount'], message: 'net_amount must equal amount minus fee' });
  }
});

export type CreatePaymentInput = z.infer<typeof createPaymentSchema>;
export type CreatePaymentHeaders = z.infer<typeof createPaymentHeadersSchema>;
export type PaymentOrderParams = z.infer<typeof paymentOrderParamsSchema>;
export type SumopodPaymentResponse = z.infer<typeof sumopodPaymentResponseSchema>;
