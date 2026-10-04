import { z } from 'zod';

const positiveQueryInteger = z.preprocess(
  (value) => typeof value === 'string' && /^\d+$/.test(value) ? Number(value) : value,
  z.number().int().positive(),
);

const httpsUrl = z.string().trim().max(2048).url().refine((value) => {
  const parsed = new URL(value);
  return parsed.protocol === 'https:' && !parsed.username && !parsed.password;
}, 'URL must use HTTPS and must not contain credentials');

const title = z.string().trim().min(1).max(200);
const slug = z.string().trim().toLowerCase().min(3).max(220)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug must use lowercase letters, numbers, and single hyphens');
const excerpt = z.string().trim().min(1).max(500).nullable();
const content = z.string().trim().min(1).refine((value) => Array.from(value).length <= 50_000, 'Content must be at most 50000 characters');
const coverUrl = httpsUrl.nullable();
const status = z.enum(['draft', 'published']);

export const blogIdParamsSchema = z.object({
  blogId: z.string().uuid(),
}).strict();

export const listBlogsQuerySchema = z.object({
  page: positiveQueryInteger.default(1),
  limit: positiveQueryInteger.pipe(z.number().max(100)).default(20),
  search: z.string().trim().min(1).max(100).optional(),
}).strict();

export const listAdminBlogsQuerySchema = listBlogsQuerySchema.extend({
  status: status.optional(),
}).strict();

export const createBlogSchema = z.object({
  title,
  slug,
  excerpt: excerpt.optional(),
  content,
  status: status.default('draft'),
}).strict();

export const updateBlogSchema = z.object({
  title: title.optional(),
  slug: slug.optional(),
  excerpt: excerpt.optional(),
  content: content.optional(),
  coverUrl: coverUrl.optional(),
  status: status.optional(),
}).strict().refine((value) => Object.keys(value).length > 0, {
  message: 'At least one field is required',
});

export type BlogIdParams = z.infer<typeof blogIdParamsSchema>;
export type ListBlogsQuery = z.infer<typeof listBlogsQuerySchema>;
export type ListAdminBlogsQuery = z.infer<typeof listAdminBlogsQuerySchema>;
export type CreateBlogInput = z.infer<typeof createBlogSchema>;
export type UpdateBlogInput = z.infer<typeof updateBlogSchema>;
