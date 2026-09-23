import { hasActiveRole, insertUserRole, isUniqueUserRoleError, UserRoleRoleNotFoundError, UserRoleUserNotFoundError, type UserRoleRecord } from '../models/user-role.model';
import type { CreateUserRoleInput } from '../validations/user-role.validation';
import { AppError } from '../utils/app-error';

export const createUserRole = async (actorUserId: string, input: CreateUserRoleInput): Promise<UserRoleRecord> => {
  if (!(await hasActiveRole(actorUserId, 'admin'))) throw new AppError(403, 'FORBIDDEN', 'Admin role is required');
  try {
    return await insertUserRole({ userId: input.userId, roleId: input.roleId });
  } catch (error) {
    if (error instanceof UserRoleUserNotFoundError) throw new AppError(404, 'USER_NOT_FOUND', 'User not found');
    if (error instanceof UserRoleRoleNotFoundError) throw new AppError(404, 'ROLE_NOT_FOUND', 'Role not found');
    if (isUniqueUserRoleError(error)) throw new AppError(409, 'USER_ROLE_ALREADY_EXISTS', 'User already has this role');
    throw error;
  }
};
