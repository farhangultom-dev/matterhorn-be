import type { RequestHandler } from 'express';
import { hasAnyActiveRoleId } from '../models/user-role.model';
import { AppError } from '../utils/app-error';

export const requireBlogAdmin: RequestHandler = async (request, _response, next) => {
  try {
    if (!(await hasAnyActiveRoleId(request.auth!.userId, [1]))) {
      next(new AppError(403, 'FORBIDDEN', 'Active admin role ID 1 is required'));
      return;
    }
    next();
  } catch (error) {
    next(error);
  }
};
