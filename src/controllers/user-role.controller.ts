import type { RequestHandler } from 'express';
import { createUserRole } from '../services/user-role.service';
import type { CreateUserRoleInput } from '../validations/user-role.validation';
import { successResponse } from '../views/response.view';
import { presentUserRole } from '../views/user-role.view';

export const createUserRoleController: RequestHandler = async (request, response) => {
  const userRole = await createUserRole(request.auth!.userId, response.locals.validatedBody as CreateUserRoleInput);
  response.status(201).json(successResponse('User role assigned', { userRole: presentUserRole(userRole) }));
};
