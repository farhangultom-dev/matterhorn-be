import { z } from 'zod';

export const createUserRoleSchema = z.object({
  userId: z.string().uuid(),
  roleId: z.number().int().positive(),
}).strict();

export type CreateUserRoleInput = z.infer<typeof createUserRoleSchema>;
