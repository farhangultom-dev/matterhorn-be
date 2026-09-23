import { getDatabase } from '../config/database';

export interface RoleRecord {
  readonly id: number;
  readonly name: string;
  readonly created_at: Date;
}

export const findActiveRoles = async (): Promise<RoleRecord[]> =>
  getDatabase()<RoleRecord>('roles')
    .select('id', 'name', 'created_at')
    .whereNull('deleted_at')
    .orderBy([{ column: 'name', order: 'asc' }, { column: 'id', order: 'asc' }]);
