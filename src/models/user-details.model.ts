import type { Knex } from 'knex';
import { getDatabase } from '../config/database';

export interface UserDetailsRecord {
  readonly id: number;
  readonly user_id: string;
  readonly name: string;
  readonly address: string | null;
  readonly city_id: number | null;
  readonly phone_number: string | null;
  readonly gender: string | null;
  readonly height: number | null;
  readonly weight: number | null;
  readonly profile_photo: string | null;
  readonly created_at: Date;
  readonly deleted_at: Date | null;
}

export interface ActiveUserRecord {
  readonly id: string;
  readonly name: string;
}

export interface UserDetailsValues {
  readonly name: string;
  readonly address: string | null;
  readonly city_id: number | null;
  readonly phone_number: string | null;
  readonly gender: string | null;
  readonly height: number | null;
  readonly weight: number | null;
  readonly profile_photo: string | null;
}

const columns = ['id', 'user_id', 'name', 'address', 'city_id', 'phone_number', 'gender', 'height', 'weight', 'profile_photo', 'created_at', 'deleted_at'] as const;

const selectDetails = (query: Knex.QueryBuilder<UserDetailsRecord, UserDetailsRecord[]>): Knex.QueryBuilder<UserDetailsRecord, UserDetailsRecord[]> => query.select(columns);

export const findActiveUser = async (userId: string): Promise<ActiveUserRecord | undefined> =>
  getDatabase()<ActiveUserRecord>('users').select('id', 'name').where({ id: userId }).whereNull('deleted_at').first();

export const findActiveUserForUpdate = async (transaction: Knex.Transaction, userId: string): Promise<ActiveUserRecord | undefined> =>
  transaction<ActiveUserRecord>('users').select('id', 'name').where({ id: userId }).whereNull('deleted_at').forUpdate().first();

export const findActiveCity = async (cityId: number): Promise<number | undefined> =>
  getDatabase()('cities')
    .join('provinces', 'provinces.id', 'cities.province_id')
    .where('cities.id', cityId)
    .whereNull('cities.deleted_at')
    .whereNull('provinces.deleted_at')
    .select('cities.id')
    .first()
    .then((row: { id: number } | undefined) => row?.id);

export const findActiveCityInTransaction = async (transaction: Knex.Transaction, cityId: number): Promise<number | undefined> =>
  transaction('cities')
    .join('provinces', 'provinces.id', 'cities.province_id')
    .where('cities.id', cityId)
    .whereNull('cities.deleted_at')
    .whereNull('provinces.deleted_at')
    .select('cities.id')
    .first()
    .then((row: { id: number } | undefined) => row?.id);

export const findUserDetailsByUserId = async (transaction: Knex.Transaction, userId: string): Promise<UserDetailsRecord | undefined> =>
  selectDetails(transaction<UserDetailsRecord>('user_details')).where({ user_id: userId }).first();

export const findActiveUserDetailsByUserId = async (userId: string): Promise<UserDetailsRecord | undefined> =>
  selectDetails(getDatabase()<UserDetailsRecord>('user_details')).where({ user_id: userId }).whereNull('deleted_at').first();

export const upsertUserDetails = async (transaction: Knex.Transaction, userId: string, values: UserDetailsValues): Promise<UserDetailsRecord> => {
  const rows = await transaction<UserDetailsRecord>('user_details')
    .insert({ user_id: userId, ...values, deleted_at: null })
    .onConflict('user_id')
    .merge({ ...values, deleted_at: null })
    .returning(columns);
  const row = rows[0];
  if (!row) throw new Error('User details upsert did not return a row.');
  return row;
};

export const updateUserName = async (transaction: Knex.Transaction, userId: string, name: string): Promise<void> => {
  await transaction('users').where({ id: userId }).update({ name, updated_at: transaction.fn.now() });
};
