import { Router } from 'express';
import {
  createBlogController,
  deleteBlogController,
  getAdminBlogController,
  getPublicBlogController,
  listAdminBlogsController,
  listPublicBlogsController,
  updateBlogController,
} from '../controllers/blog.controller';
import { authenticate } from '../middlewares/authenticate.middleware';
import { parseBlogCreateRequest } from '../middlewares/blog-cover-upload.middleware';
import { requireBlogAdmin } from '../middlewares/require-blog-admin.middleware';
import { validateBody, validateParams, validateQuery } from '../middlewares/validate.middleware';
import { blogIdParamsSchema, blogSlugParamsSchema, listAdminBlogsQuerySchema, listBlogsQuerySchema, updateBlogSchema } from '../validations/blog.validation';

const router = Router();
const preventPrivateBlogCaching: import('express').RequestHandler = (_request, response, next) => {
  response.setHeader('Cache-Control', 'private, no-store');
  next();
};

router.get('/manage', preventPrivateBlogCaching, authenticate, validateQuery(listAdminBlogsQuerySchema), listAdminBlogsController);
router.get('/manage/:slug', preventPrivateBlogCaching, authenticate, validateParams(blogSlugParamsSchema), getAdminBlogController);
router.get('/', validateQuery(listBlogsQuerySchema), listPublicBlogsController);
router.post('/', authenticate, requireBlogAdmin, parseBlogCreateRequest, createBlogController);
router.patch('/:blogId', authenticate, validateParams(blogIdParamsSchema), validateBody(updateBlogSchema), updateBlogController);
router.delete('/:blogId', authenticate, validateParams(blogIdParamsSchema), deleteBlogController);
router.get('/:slug', validateParams(blogSlugParamsSchema), getPublicBlogController);

export default router;
