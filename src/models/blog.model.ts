import type { Knex } from 'knex';
import { getDatabase } from '../config/database';

export type BlogStatus = 'draft' | 'published';

export interface BlogRecord {
  readonly id: string;
  readonly author_user_id: string;
  readonly title: string;
  readonly slug: string;
  readonly excerpt: string | null;
  readonly content: string;
  readonly cover_url: string | null;
  readonly status: BlogStatus;
  readonly published_at: Date | null;
  readonly created_at: Date;
  readonly updated_at: Date;
  readonly deleted_at: Date | null;
}

export type BlogSummaryRecord = Omit<BlogRecord, 'content' | 'deleted_at'>;

export interface BlogListFilters {
  readonly page: number;
  readonly limit: number;
  readonly search?: string;
  readonly status?: BlogStatus;
}

export interface BlogListResult {
  readonly rows: BlogSummaryRecord[];
  readonly total: number;
}

export interface BlogCreateValues {
  readonly id: string;
  readonly author_user_id: string;
  readonly title: string;
  readonly slug: string;
  readonly excerpt: string | null;
  readonly content: string;
  readonly cover_url: string | null;
  readonly status: BlogStatus;
  readonly published_at: Date | null;
}

export interface BlogUpdateValues {
  readonly title?: string;
  readonly slug?: string;
  readonly excerpt?: string | null;
  readonly content?: string;
  readonly cover_url?: string | null;
  readonly status?: BlogStatus;
  readonly published_at?: Date | null;
}

export type BlogTransaction = Knex.Transaction;

const summaryColumns = [
  'id', 'author_user_id', 'title', 'slug', 'excerpt', 'cover_url', 'status', 'published_at', 'created_at', 'updated_at',
] as const;
const detailColumns = [...summaryColumns, 'content', 'deleted_at'] as const;
type SummaryQuery = Knex.QueryBuilder<BlogSummaryRecord, BlogSummaryRecord[]>;
type DetailQuery = Knex.QueryBuilder<BlogRecord, BlogRecord[]>;

const escapeLikePattern = (value: string): string => value.replace(/[\\%_]/g, '\\$&');

const applySearch = <TRecord extends object, TResult>(query: Knex.QueryBuilder<TRecord, TResult>, search?: string): Knex.QueryBuilder<TRecord, TResult> => {
  if (!search) return query;
  const pattern = `%${escapeLikePattern(search)}%`;
  return query.whereRaw("blogs.title ILIKE ? ESCAPE '\\'", [pattern]);
};

const selectSummaryColumns = (query: SummaryQuery): SummaryQuery => query.select(...summaryColumns);
const selectDetailColumns = (query: DetailQuery): DetailQuery => query.select(...detailColumns);

export const findPublicBlogs = async (filters: BlogListFilters): Promise<BlogListResult> => {
  const baseQuery = getDatabase()<BlogSummaryRecord>('blogs')
    .whereNull('deleted_at')
    .where({ status: 'published' });
  applySearch(baseQuery, filters.search);
  const countRow = await baseQuery.clone().count<{ count: string }>({ count: 'id' }).first();
  const rows = await selectSummaryColumns(baseQuery.clone())
    .orderBy([{ column: 'published_at', order: 'desc' }, { column: 'id', order: 'desc' }])
    .limit(filters.limit)
    .offset((filters.page - 1) * filters.limit);
  return { rows, total: Number(countRow?.count ?? 0) };
};

export const findPublicBlogById = async (blogId: string): Promise<BlogRecord | undefined> =>
  selectDetailColumns(getDatabase()<BlogRecord>('blogs'))
    .where({ id: blogId, status: 'published' })
    .whereNull('deleted_at')
    .first();

const buildAdminBlogQuery = (filters: BlogListFilters): SummaryQuery => {
  const query = getDatabase()<BlogSummaryRecord>('blogs').whereNull('deleted_at');
  if (filters.status !== undefined) query.where({ status: filters.status });
  applySearch(query, filters.search);
  return query;
};

export const findAdminBlogs = async (filters: BlogListFilters): Promise<BlogListResult> => {
  const baseQuery = buildAdminBlogQuery(filters);
  const countRow = await baseQuery.clone().count<{ count: string }>({ count: 'id' }).first();
  const rows = await selectSummaryColumns(baseQuery.clone())
    .orderBy([{ column: 'created_at', order: 'desc' }, { column: 'id', order: 'desc' }])
    .limit(filters.limit)
    .offset((filters.page - 1) * filters.limit);
  return { rows, total: Number(countRow?.count ?? 0) };
};

export const findAdminBlogById = async (blogId: string): Promise<BlogRecord | undefined> =>
  selectDetailColumns(getDatabase()<BlogRecord>('blogs'))
    .where({ id: blogId })
    .whereNull('deleted_at')
    .first();

export const findBlogForUpdate = async (transaction: BlogTransaction, blogId: string): Promise<BlogRecord | undefined> =>
  selectDetailColumns(transaction<BlogRecord>('blogs'))
    .where({ id: blogId })
    .whereNull('deleted_at')
    .forUpdate()
    .first();

export const insertBlog = async (transaction: BlogTransaction, values: BlogCreateValues): Promise<BlogRecord> => {
  const rows = await transaction<BlogRecord>('blogs')
    .insert(values)
    .returning([...detailColumns]);
  const blog = rows[0];
  if (!blog) throw new Error('Blog insert did not return a row.');
  return blog;
};

export const updateBlog = async (transaction: BlogTransaction, blogId: string, values: BlogUpdateValues): Promise<BlogRecord> => {
  const rows = await transaction<BlogRecord>('blogs')
    .where({ id: blogId })
    .whereNull('deleted_at')
    .update({ ...values, updated_at: transaction.fn.now() })
    .returning([...detailColumns]);
  const blog = rows[0];
  if (!blog) throw new Error('Blog update did not return a row.');
  return blog;
};

export const softDeleteBlog = async (transaction: BlogTransaction, blogId: string): Promise<void> => {
  await transaction('blogs')
    .where({ id: blogId })
    .whereNull('deleted_at')
    .update({ deleted_at: transaction.fn.now(), updated_at: transaction.fn.now() });
};

export const isUniqueBlogSlugError = (error: unknown): boolean => {
  const candidate = error as { code?: string; constraint?: string };
  return candidate.code === '23505' && candidate.constraint === 'blogs_slug_unique';
};
