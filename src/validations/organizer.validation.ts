import { z } from 'zod';

const httpsUrl = z.string().trim().max(2048).url().refine((value) => {
  const parsed = new URL(value);
  return parsed.protocol === 'https:' && !parsed.username && !parsed.password;
}, 'URL must use HTTPS and must not contain credentials');

const nullableUuid = z.string().uuid().nullable().optional();
const nullableText = (max: number) => z.string().trim().min(1).max(max).nullable().optional();

const organizerFields = {
  name: z.string().trim().min(1).max(150),
  userId: nullableUuid,
  communityId: nullableUuid,
  logoUrl: httpsUrl.nullable().optional(),
  email: z.string().trim().toLowerCase().email().max(254).nullable().optional(),
  phone: nullableText(30),
} as const;

export const organizerIdParamsSchema = z.object({
  organizerId: z.string().uuid(),
}).strict();

export const createOrganizerSchema = z.object(organizerFields).strict();

export const updateOrganizerSchema = z.object({
  name: organizerFields.name.optional(),
  userId: organizerFields.userId,
  communityId: organizerFields.communityId,
  logoUrl: organizerFields.logoUrl,
  email: organizerFields.email,
  phone: organizerFields.phone,
}).strict().refine((value) => Object.keys(value).length > 0, { message: 'At least one field is required' });

export type OrganizerIdParams = z.infer<typeof organizerIdParamsSchema>;
export type CreateOrganizerInput = z.infer<typeof createOrganizerSchema>;
export type UpdateOrganizerInput = z.infer<typeof updateOrganizerSchema>;
