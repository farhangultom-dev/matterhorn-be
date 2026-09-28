import { z } from 'zod';

export const addUserDisciplineSportSchema = z.object({
  disciplineSportId: z.number().int().positive(),
}).strict();

export type AddUserDisciplineSportInput = z.infer<typeof addUserDisciplineSportSchema>;
