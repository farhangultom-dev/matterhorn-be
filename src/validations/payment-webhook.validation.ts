import { z } from 'zod';

const MAX_POSTGRES_INTEGER = 2_147_483_647;
const timestamp = z.string().datetime({ offset: true });

const completedDataSchema = z.object({
  payment_id: z.string().uuid(),
  order_id: z.string().trim().min(1).max(150),
  amount: z.number().int().positive().max(MAX_POSTGRES_INTEGER),
  fee: z.number().int().min(0).max(MAX_POSTGRES_INTEGER),
  net_amount: z.number().int().min(0).max(MAX_POSTGRES_INTEGER),
  status: z.literal('completed'),
  payment_method: z.string().trim().min(1).max(50),
  paid_at: timestamp,
  settled_at: timestamp,
  completed_at: timestamp,
}).strict().superRefine((value, context) => {
  if (value.amount !== value.net_amount + value.fee) {
    context.addIssue({ code: 'custom', path: ['amount'], message: 'amount must equal net_amount plus fee' });
  }
});

const terminalDataSchema = z.object({
  payment_id: z.string().uuid(),
  order_id: z.string().trim().min(1).max(150),
  amount: z.number().int().positive().max(MAX_POSTGRES_INTEGER),
  fee: z.number().int().min(0).max(MAX_POSTGRES_INTEGER),
  net_amount: z.number().int().min(0).max(MAX_POSTGRES_INTEGER),
  payment_method: z.string().trim().min(1).max(50),
  paid_at: timestamp.nullable().optional(),
  settled_at: timestamp.nullable().optional(),
  completed_at: timestamp.nullable().optional(),
}).strict().superRefine((value, context) => {
  if (value.amount !== value.net_amount + value.fee) {
    context.addIssue({ code: 'custom', path: ['amount'], message: 'amount must equal net_amount plus fee' });
  }
});

export const sumopodWebhookSchema = z.discriminatedUnion('event_type', [
  z.object({ event_type: z.literal('payment.completed'), data: completedDataSchema }).strict(),
  z.object({ event_type: z.literal('payment.failed'), data: terminalDataSchema.extend({ status: z.literal('failed') }).strict() }).strict(),
  z.object({ event_type: z.literal('payment.expired'), data: terminalDataSchema.extend({ status: z.literal('expired') }).strict() }).strict(),
  z.object({ event_type: z.literal('payment.test'), data: z.record(z.string(), z.unknown()).optional() }).strict(),
]);

export type SumopodWebhookEvent = z.infer<typeof sumopodWebhookSchema>;
export type SumopodPaymentMutationEvent = Exclude<SumopodWebhookEvent, { readonly event_type: 'payment.test' }>;
