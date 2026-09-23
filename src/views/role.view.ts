import type { RoleRecord } from '../models/role.model';

export interface PublicRole {
  readonly id: number;
  readonly name: string;
  readonly createdAt: string;
}

export const presentRole = (role: RoleRecord): PublicRole => ({
  id: role.id,
  name: role.name,
  createdAt: new Date(role.created_at).toISOString(),
});
