import type { UserRoleRecord, UserRoleWithNameRecord } from '../models/user-role.model';

export interface PublicUserRole {
  readonly id: number;
  readonly userId: string;
  readonly roleId: number;
  readonly createdAt: string;
}

export interface PublicUserRoleWithName extends PublicUserRole {
  readonly roleName: string;
}

export const presentUserRole = (userRole: UserRoleRecord): PublicUserRole => ({
  id: userRole.id,
  userId: userRole.user_id,
  roleId: userRole.role_id,
  createdAt: new Date(userRole.created_at).toISOString(),
});

export const presentUserRoleWithName = (userRole: UserRoleWithNameRecord): PublicUserRoleWithName => ({
  ...presentUserRole(userRole),
  roleName: userRole.role_name,
});
