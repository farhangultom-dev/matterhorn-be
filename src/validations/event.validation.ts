import { z } from 'zod';

const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const timestamp = z.string().datetime({ offset: true });

const httpsUrl = z.string().trim().max(2048).url().refine((value) => {
  const parsed = new URL(value);
  return parsed.protocol === 'https:' && !parsed.username && !parsed.password;
}, 'URL must use HTTPS and must not contain credentials');

const nullableText = (max: number) => z.string().trim().min(1).max(max).nullable().optional();
const nullableTimestamp = timestamp.nullable().optional();
const positiveQueryInteger = z.preprocess(
  (value) => typeof value === 'string' && /^\d+$/.test(value) ? Number(value) : value,
  z.number().int().positive(),
);

const eventType = z.enum(['training', 'competition', 'meetup', 'other']);
const visibility = z.enum(['public', 'private']);

export const eventIdParamsSchema = z.object({
  eventId: z.string().uuid(),
}).strict();

export const listEventsQuerySchema = z.object({
  page: positiveQueryInteger.default(1),
  limit: positiveQueryInteger.pipe(z.number().max(100)).default(20),
  search: z.string().trim().min(1).max(100).optional(),
  cityId: positiveQueryInteger.optional(),
  disciplineSportId: positiveQueryInteger.optional(),
  organizerId: z.string().uuid().optional(),
  eventType: eventType.optional(),
  startsFrom: timestamp.optional(),
}).strict();

const eventCreateFields = {
  organizerId: z.string().uuid(),
  title: z.string().trim().min(1).max(200),
  slug: z.string().trim().toLowerCase().min(3).max(220).regex(slugPattern, 'Slug must use lowercase letters, numbers, and single hyphens'),
  description: nullableText(5000),
  eventType,
  visibility: visibility.default('public'),
  startsAt: timestamp,
  endsAt: timestamp,
  venueName: nullableText(200),
  venueAddress: nullableText(2000),
  venueGmapsUrl: httpsUrl.nullable().optional(),
  cityId: z.number().int().positive().nullable().optional(),
  capacity: z.number().int().positive().nullable().optional(),
  registrationOpenAt: nullableTimestamp,
  registrationCloseAt: nullableTimestamp,
} as const;

const eventPosterUrl = httpsUrl.nullable().optional();

const eventTicketType = z.object({
  name: z.string().trim().min(1).max(100),
  price: z.number().int().min(0),
  quota: z.number().int().positive(),
  salesStartAt: timestamp,
  salesEndAt: timestamp,
}).strict().superRefine((value, context) => {
  if (new Date(value.salesEndAt).getTime() <= new Date(value.salesStartAt).getTime()) {
    context.addIssue({ code: 'custom', path: ['salesEndAt'], message: 'salesEndAt must be later than salesStartAt' });
  }
});

const validateTimeRanges = (value: { startsAt: string; endsAt: string; registrationOpenAt?: string | null; registrationCloseAt?: string | null }, context: z.RefinementCtx): void => {
  if (new Date(value.endsAt).getTime() <= new Date(value.startsAt).getTime()) {
    context.addIssue({ code: 'custom', path: ['endsAt'], message: 'endsAt must be later than startsAt' });
  }
  if (value.registrationOpenAt !== undefined && value.registrationOpenAt !== null && value.registrationCloseAt !== undefined && value.registrationCloseAt !== null && new Date(value.registrationCloseAt).getTime() <= new Date(value.registrationOpenAt).getTime()) {
    context.addIssue({ code: 'custom', path: ['registrationCloseAt'], message: 'registrationCloseAt must be later than registrationOpenAt' });
  }
};

export const createEventSchema = z.object({
  ...eventCreateFields,
  disciplineSports: z.array(z.number().int().positive()).max(50).default([]),
  ticketTypes: z.array(eventTicketType).max(50).default([]),
}).strict().superRefine((value, context) => {
  validateTimeRanges(value, context);
  const uniqueDisciplineSports = new Set(value.disciplineSports);
  if (uniqueDisciplineSports.size !== value.disciplineSports.length) {
    context.addIssue({ code: 'custom', path: ['disciplineSports'], message: 'disciplineSports must not contain duplicate IDs' });
  }
  const uniqueTicketTypeNames = new Set(value.ticketTypes.map((ticketType) => ticketType.name.toLowerCase()));
  if (uniqueTicketTypeNames.size !== value.ticketTypes.length) {
    context.addIssue({ code: 'custom', path: ['ticketTypes'], message: 'ticketTypes must not contain duplicate names' });
  }
});

export const updateEventSchema = z.object({
  organizerId: eventCreateFields.organizerId.optional(),
  title: eventCreateFields.title.optional(),
  slug: eventCreateFields.slug.optional(),
  description: eventCreateFields.description,
  eventType: eventCreateFields.eventType.optional(),
  visibility: eventCreateFields.visibility.optional(),
  startsAt: eventCreateFields.startsAt.optional(),
  endsAt: eventCreateFields.endsAt.optional(),
  venueName: eventCreateFields.venueName,
  venueAddress: eventCreateFields.venueAddress,
  venueGmapsUrl: eventCreateFields.venueGmapsUrl,
  cityId: eventCreateFields.cityId,
  capacity: eventCreateFields.capacity,
  registrationOpenAt: eventCreateFields.registrationOpenAt,
  registrationCloseAt: eventCreateFields.registrationCloseAt,
  posterUrl: eventPosterUrl,
}).strict().refine((value) => Object.keys(value).length > 0, { message: 'At least one field is required' });

export type EventIdParams = z.infer<typeof eventIdParamsSchema>;
export type ListEventsQuery = z.infer<typeof listEventsQuerySchema>;
export type CreateEventInput = z.infer<typeof createEventSchema>;
export type UpdateEventInput = z.infer<typeof updateEventSchema>;
