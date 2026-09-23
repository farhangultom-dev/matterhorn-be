import { z } from 'zod';

const nullableTrimmedText = (max: number) => z.string().trim().min(1).max(max).nullable();

const detailFields = {
  name: z.string().trim().min(1).max(100).optional(),
  address: nullableTrimmedText(1000).optional(),
  cityId: z.number().int().positive().nullable().optional(),
  phoneNumber: nullableTrimmedText(30).optional(),
  gender: z.enum(['male', 'female', 'other', 'prefer_not_to_say']).nullable().optional(),
  height: z.number().int().min(30).max(300).nullable().optional(),
  weight: z.number().int().min(1).max(500).nullable().optional(),
} as const;

export const updateUserDetailsFieldsSchema = z.object(detailFields).strict();

export const updateUserDetailsSchema = updateUserDetailsFieldsSchema
  .extend({ profilePhoto: z.null().optional() })
  .strict()
  .refine((value) => Object.keys(value).length > 0, { message: 'At least one field is required' });

export type UpdateUserDetailsInput = z.infer<typeof updateUserDetailsSchema>;
export type UpdateUserDetailsFieldsInput = z.infer<typeof updateUserDetailsFieldsSchema>;

