import type { RequestHandler } from 'express';
import { getAllRoles } from '../services/role.service';
import { successResponse } from '../views/response.view';
import { presentRole } from '../views/role.view';

export const getRolesController: RequestHandler = async (_request, response) => {
  const roles = await getAllRoles();
  response.json(successResponse('Roles retrieved', { roles: roles.map(presentRole) }));
};
