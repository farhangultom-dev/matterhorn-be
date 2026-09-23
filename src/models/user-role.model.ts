import type { Knex } from 'knex';
import { getDatabase } from '../config/database';

export interface UserRoleRecord {
  readonly id: number;
  readonly user_id: string;
  readonly role_id: number;
  readonly created_at: Date;
}

export class UserRoleUserNotFoundError extends Error {
  public constructor() {
    super('User is not active');
    this.name = 'UserRoleUserNotFoundError';
  }
}

export class UserRoleRoleNotFoundError extends Error {
  public constructor() {
    super('Role is not active');
    this.name = 'UserRoleRoleNotFoundError';
  }
}

export const hasActiveRole = async (userId: string, roleName: string): Promise<boolean> => {
  const row = await getDatabase()('user_roles as ur')
    .join('roles as r', 'r.id', 'ur.role_id')
    .join('users as u', 'u.id', 'ur.user_id')
    .select('ur.id')
    .where('ur.user_id', userId)
    .where('r.name', roleName)
    .whereNull('ur.deleted_at')
    .whereNull('r.deleted_at')
    .whereNull('u.deleted_at')
    .first();
  return row !== undefined;
};

export const hasAnyActiveRole = async (userId: string, roleNames: readonly string[]): Promise<boolean> => {
  if (roleNames.length === 0) return false;
  const row = await getDatabase()('user_roles as ur')
    .join('roles as r', 'r.id', 'ur.role_id')
    .join('users as u', 'u.id', 'ur.user_id')
    .select('ur.id')
    .where('ur.user_id', userId)
    .whereIn('r.name', roleNames)
    .whereNull('ur.deleted_at')
    .whereNull('r.deleted_at')
    .whereNull('u.deleted_at')
    .first();
  return row !== undefined;
};

export const hasAnyActiveRoleId = async (userId: string, roleIds: readonly number[]): Promise<boolean> => {
  if (roleIds.length === 0) return false;
  const row = await getDatabase()('user_roles as ur')
    .join('roles as r', 'r.id', 'ur.role_id')
    .join('users as u', 'u.id', 'ur.user_id')
    .select('ur.id')
    .where('ur.user_id', userId)
    .whereIn('ur.role_id', roleIds)
    .whereNull('ur.deleted_at')
    .whereNull('r.deleted_at')
    .whereNull('u.deleted_at')
    .first();
  return row !== undefined;
};

export const insertUserRole = async ({ userId, roleId }: { userId: string; roleId: number }): Promise<UserRoleRecord> =>
  getDatabase().transaction(async (transaction: Knex.Transaction) => {
    const user = await transaction('users').select('id').where({ id: userId }).whereNull('deleted_at').forUpdate().first();
    if (!user) throw new UserRoleUserNotFoundError();

    const role = await transaction('roles').select('id').where({ id: roleId }).whereNull('deleted_at').first();
    if (!role) throw new UserRoleRoleNotFoundError();

    const rows = await transaction<UserRoleRecord>('user_roles')
      .insert({ user_id: userId, role_id: roleId })
      .returning(['id', 'user_id', 'role_id', 'created_at']);
    const created = rows[0];
    if (!created) throw new Error('User role insert did not return a row.');
    return created;
  });

export const isUniqueUserRoleError = (error: unknown): boolean => {
  const candidate = error as { code?: string; constraint?: string };
  return candidate.code === '23505' && candidate.constraint === 'user_roles_user_id_role_id_unique';
};
