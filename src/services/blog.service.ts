import { randomUUID } from 'node:crypto';
import { getDatabase } from '../config/database';
import { findAdminBlogById, findAdminBlogs, findBlogForUpdate, findPublicBlogById, findPublicBlogs, insertBlog, isUniqueBlogSlugError, softDeleteBlog, updateBlog, type BlogCreateValues, type BlogRecord, type BlogUpdateValues } from '../models/blog.model';
import { hasAnyActiveRoleId } from '../models/user-role.model';
import { getDatabaseNow } from '../models/email-verification-otp.model';
import type { CreateBlogInput, ListAdminBlogsQuery, ListBlogsQuery, UpdateBlogInput } from '../validations/blog.validation';
import { AppError } from '../utils/app-error';
import { deleteUploadedBlogCover, uploadBlogCover, type BlogCoverFile, type UploadedBlogCover } from './blog-cover-storage.service';
import { StorageUnavailableError } from './profile-photo-storage.service';

const BLOG_ADMIN_ROLE_IDS = [1] as const;

const assertBlogAdminAccess = async (actorUserId: string): Promise<void> => {
  if (!(await hasAnyActiveRoleId(actorUserId, BLOG_ADMIN_ROLE_IDS))) {
    throw new AppError(403, 'FORBIDDEN', 'Active admin role ID 1 is required');
  }
};

const blogNotFound = (): AppError => new AppError(404, 'BLOG_NOT_FOUND', 'Blog not found');
const mapBlogSlugError = (error: unknown): never => {
  if (isUniqueBlogSlugError(error)) throw new AppError(409, 'BLOG_SLUG_EXISTS', 'Blog slug is already in use');
  throw error;
};

const toCreateValues = (id: string, authorUserId: string, input: CreateBlogInput, coverUrl: string | null, publishedAt: Date | null): BlogCreateValues => ({
  id,
  author_user_id: authorUserId,
  title: input.title,
  slug: input.slug,
  excerpt: input.excerpt ?? null,
  content: input.content,
  cover_url: coverUrl,
  status: input.status,
  published_at: publishedAt,
});

const hasField = <T extends object>(input: T, field: keyof T): boolean => Object.prototype.hasOwnProperty.call(input, field);

const toUpdateValues = (input: UpdateBlogInput): BlogUpdateValues => ({
  ...(input.title !== undefined ? { title: input.title } : {}),
  ...(input.slug !== undefined ? { slug: input.slug } : {}),
  ...(hasField(input, 'excerpt') ? { excerpt: input.excerpt ?? null } : {}),
  ...(input.content !== undefined ? { content: input.content } : {}),
  ...(hasField(input, 'coverUrl') ? { cover_url: input.coverUrl ?? null } : {}),
  ...(input.status !== undefined ? { status: input.status } : {}),
});

export const getPublicBlogs = (filters: ListBlogsQuery) => findPublicBlogs(filters);

export const getPublicBlog = async (blogId: string): Promise<BlogRecord> => {
  const blog = await findPublicBlogById(blogId);
  if (!blog) throw blogNotFound();
  return blog;
};

export const getAdminBlogs = async (actorUserId: string, filters: ListAdminBlogsQuery) => {
  await assertBlogAdminAccess(actorUserId);
  return findAdminBlogs(filters);
};

export const getAdminBlog = async (actorUserId: string, blogId: string): Promise<BlogRecord> => {
  await assertBlogAdminAccess(actorUserId);
  const blog = await findAdminBlogById(blogId);
  if (!blog) throw blogNotFound();
  return blog;
};

export const createBlog = async (actorUserId: string, input: CreateBlogInput, file?: BlogCoverFile): Promise<BlogRecord> => {
  await assertBlogAdminAccess(actorUserId);
  const id = randomUUID();
  let uploaded: UploadedBlogCover | undefined;
  let committed = false;
  try {
    if (file) uploaded = await uploadBlogCover({ blogId: id, file });
    const blog = await getDatabase().transaction(async (transaction) => {
      const publishedAt = input.status === 'published' ? await getDatabaseNow(transaction) : null;
      return insertBlog(transaction, toCreateValues(id, actorUserId, input, uploaded?.url ?? null, publishedAt));
    });
    committed = true;
    return blog;
  } catch (error) {
    if (uploaded && !committed) {
      try {
        await deleteUploadedBlogCover(uploaded.key);
      } catch {
        // Rollback cleanup is best effort and must not hide the original error.
      }
    }
    if (error instanceof StorageUnavailableError) throw new AppError(503, 'STORAGE_UNAVAILABLE', 'Blog cover storage is unavailable');
    return mapBlogSlugError(error);
  }
};

export const updateBlogById = async (actorUserId: string, blogId: string, input: UpdateBlogInput): Promise<BlogRecord> => {
  await assertBlogAdminAccess(actorUserId);
  let values = toUpdateValues(input);
  try {
    return await getDatabase().transaction(async (transaction) => {
      const current = await findBlogForUpdate(transaction, blogId);
      if (!current) throw blogNotFound();

      const nextStatus = input.status ?? current.status;
      if (nextStatus !== current.status) {
        values = {
          ...values,
          published_at: nextStatus === 'published' ? await getDatabaseNow(transaction) : null,
        };
      }
      return updateBlog(transaction, blogId, values);
    });
  } catch (error) {
    if (error instanceof AppError) throw error;
    return mapBlogSlugError(error);
  }
};

export const deleteBlog = async (actorUserId: string, blogId: string): Promise<void> => {
  await assertBlogAdminAccess(actorUserId);
  await getDatabase().transaction(async (transaction) => {
    const current = await findBlogForUpdate(transaction, blogId);
    if (!current) throw blogNotFound();
    await softDeleteBlog(transaction, blogId);
  });
};
