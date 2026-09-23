import type { UserRoleRecord } from '../models/user-role.model';

export interface PublicUserRole {
  readonly id: number;
  readonly userId: string;
  readonly roleId: number;
  readonly createdAt: string;
}

export const presentUserRole = (userRole: UserRoleRecord): PublicUserRole => ({
  id: userRole.id,
  userId: userRole.user_id,
  roleId: userRole.role_id,
  createdAt: new Date(userRole.created_at).toISOString(),
});
