import { z } from 'zod';

const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const optionalNullableText = (max: number) => z.string().trim().min(1).max(max).nullable().optional();

const httpsUrl = z.string().trim().max(2048).url().refine((value) => {
  const parsed = new URL(value);
  return parsed.protocol === 'https:' && !parsed.username && !parsed.password;
}, 'URL must use HTTPS and must not contain credentials');

const positiveQueryInteger = z.preprocess(
  (value) => typeof value === 'string' && /^\d+$/.test(value) ? Number(value) : value,
  z.number().int().positive(),
);

const timeOfDay = z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/, 'Time must use HH:mm or HH:mm:ss')
  .transform((value) => value.length === 5 ? `${value}:00` : value);

export const communityIdParamsSchema = z.object({
  communityId: z.string().uuid(),
}).strict();

export const listCommunitiesQuerySchema = z.object({
  page: positiveQueryInteger.default(1),
  limit: positiveQueryInteger.pipe(z.number().max(100)).default(20),
  search: z.string().trim().min(1).max(100).optional(),
  cityId: positiveQueryInteger.optional(),
  disciplineSportId: positiveQueryInteger.optional(),
}).strict();

const communityFields = {
  name: z.string().trim().min(1).max(150),
  slug: z.string().trim().toLowerCase().min(3).max(160).regex(slugPattern, 'Slug must use lowercase letters, numbers, and single hyphens'),
  description: optionalNullableText(5000),
  logoUrl: httpsUrl.nullable().optional(),
  coverUrl: httpsUrl.nullable().optional(),
  cityId: z.number().int().positive().nullable().optional(),
  visibility: z.enum(['public', 'private']),
  contactPerson: optionalNullableText(150),
} as const;

export const createCommunitySchema = z.object({
  name: communityFields.name,
  slug: communityFields.slug,
  description: communityFields.description,
  logoUrl: communityFields.logoUrl,
  coverUrl: communityFields.coverUrl,
  cityId: communityFields.cityId,
  visibility: communityFields.visibility.default('public'),
  contactPerson: communityFields.contactPerson,
}).strict();

export const updateCommunitySchema = z.object({
  name: communityFields.name.optional(),
  slug: communityFields.slug.optional(),
  description: communityFields.description,
  logoUrl: communityFields.logoUrl,
  coverUrl: communityFields.coverUrl,
  cityId: communityFields.cityId,
  visibility: communityFields.visibility.optional(),
  status: z.enum(['draft', 'active', 'inactive', 'suspended']).optional(),
  contactPerson: communityFields.contactPerson,
}).strict().refine((value) => Object.keys(value).length > 0, { message: 'At least one field is required' });

export const addCommunityDisciplineSportSchema = z.object({
  disciplineSportId: z.number().int().positive(),
}).strict();

export const addCommunityLocationSchema = z.object({
  cityId: z.number().int().positive().nullable().optional(),
  urlGmapsLocations: httpsUrl.nullable().optional(),
  isPrimary: z.boolean().default(false),
}).strict().refine((value) => value.cityId != null || value.urlGmapsLocations != null, {
  message: 'cityId or urlGmapsLocations is required',
  path: ['cityId'],
});

export const addCommunityScheduleSchema = z.object({
  dayOfWeek: z.number().int().min(1).max(7),
  startTime: timeOfDay,
  endTime: timeOfDay,
  locationId: z.number().int().positive().nullable().optional(),
}).strict().refine((value) => value.endTime > value.startTime, {
  message: 'endTime must be later than startTime',
  path: ['endTime'],
});

export const addCommunitySocialLinkSchema = z.object({
  platform: z.string().trim().min(1).max(50).transform((value) => value.toLowerCase()),
  url: httpsUrl,
}).strict();

export type CommunityIdParams = z.infer<typeof communityIdParamsSchema>;
export type ListCommunitiesQuery = z.infer<typeof listCommunitiesQuerySchema>;
export type CreateCommunityInput = z.infer<typeof createCommunitySchema>;
export type UpdateCommunityInput = z.infer<typeof updateCommunitySchema>;
export type AddCommunityDisciplineSportInput = z.infer<typeof addCommunityDisciplineSportSchema>;
export type AddCommunityLocationInput = z.infer<typeof addCommunityLocationSchema>;
export type AddCommunityScheduleInput = z.infer<typeof addCommunityScheduleSchema>;
export type AddCommunitySocialLinkInput = z.infer<typeof addCommunitySocialLinkSchema>;
