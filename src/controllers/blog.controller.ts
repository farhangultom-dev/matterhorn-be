import type { RequestHandler } from 'express';
import { createBlog, deleteBlog, getAdminBlog, getAdminBlogs, getPublicBlog, getPublicBlogs, updateBlogById } from '../services/blog.service';
import type { BlogIdParams, BlogSlugParams, CreateBlogInput, ListAdminBlogsQuery, ListBlogsQuery, UpdateBlogInput } from '../validations/blog.validation';
import { presentBlog, presentBlogSummary } from '../views/blog.view';
import type { BlogCoverFile } from '../services/blog-cover-storage.service';
import { successResponse } from '../views/response.view';

const presentPagination = ({ page, limit, total }: { readonly page: number; readonly limit: number; readonly total: number }) => ({
  page,
  limit,
  total,
  totalPages: total === 0 ? 0 : Math.ceil(total / limit),
});

export const listPublicBlogsController: RequestHandler = async (_request, response) => {
  const filters = response.locals.validatedQuery as ListBlogsQuery;
  const result = await getPublicBlogs(filters);
  response.json(successResponse('Blogs retrieved', {
    blogs: result.rows.map(presentBlogSummary),
    pagination: presentPagination({ ...filters, total: result.total }),
  }));
};

export const listAdminBlogsController: RequestHandler = async (request, response) => {
  const filters = response.locals.validatedQuery as ListAdminBlogsQuery;
  const result = await getAdminBlogs(request.auth!.userId, filters);
  response.json(successResponse('Blogs retrieved', {
    blogs: result.rows.map(presentBlogSummary),
    pagination: presentPagination({ ...filters, total: result.total }),
  }));
};

export const getPublicBlogController: RequestHandler = async (_request, response) => {
  const { slug } = response.locals.validatedParams as BlogSlugParams;
  const blog = await getPublicBlog(slug);
  response.json(successResponse('Blog retrieved', { blog: presentBlog(blog) }));
};

export const getAdminBlogController: RequestHandler = async (request, response) => {
  const { slug } = response.locals.validatedParams as BlogSlugParams;
  const blog = await getAdminBlog(request.auth!.userId, slug);
  response.json(successResponse('Blog retrieved', { blog: presentBlog(blog) }));
};

export const createBlogController: RequestHandler = async (request, response) => {
  const blog = await createBlog(request.auth!.userId, response.locals.validatedBody as CreateBlogInput, response.locals.blogCoverFile as BlogCoverFile | undefined);
  response.status(201).json(successResponse('Blog created', { blog: presentBlog(blog) }));
};

export const updateBlogController: RequestHandler = async (request, response) => {
  const { blogId } = response.locals.validatedParams as BlogIdParams;
  const blog = await updateBlogById(request.auth!.userId, blogId, response.locals.validatedBody as UpdateBlogInput);
  response.json(successResponse('Blog updated', { blog: presentBlog(blog) }));
};

export const deleteBlogController: RequestHandler = async (request, response) => {
  const { blogId } = response.locals.validatedParams as BlogIdParams;
  await deleteBlog(request.auth!.userId, blogId);
  response.json(successResponse('Blog deleted', { deleted: true }));
};
