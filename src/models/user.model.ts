import type { Knex } from 'knex';
import { getDatabase } from '../config/database';
import { insertEmailVerificationOtp, type CreateEmailVerificationOtpInput } from './email-verification-otp.model';

export interface UserRecord {
  readonly id: string;
  readonly name: string;
  readonly email: string;
  readonly password_hash: string;
  readonly is_email_verified: boolean;
  readonly created_at: Date;
  readonly updated_at: Date;
}

interface RoleRecord {
  readonly id: number;
  readonly name: string;
  readonly deleted_at: Date | null;
}

const selectUserColumns = (query: Knex.QueryBuilder<UserRecord, UserRecord[]>): Knex.QueryBuilder<UserRecord, UserRecord[]> =>
  query.select('id', 'name', 'email', 'password_hash', 'is_email_verified', 'created_at', 'updated_at');

export const findUserByEmail = async (email: string): Promise<UserRecord | undefined> =>
  selectUserColumns(getDatabase()<UserRecord>('users')).where({ email }).whereNull('deleted_at').first();
export const findUserById = async (id: string): Promise<UserRecord | undefined> =>
  selectUserColumns(getDatabase()<UserRecord>('users')).where({ id }).whereNull('deleted_at').first();

export const findUserByEmailForUpdate = async (transaction: Knex.Transaction, email: string): Promise<UserRecord | undefined> =>
  selectUserColumns(transaction<UserRecord>('users')).where({ email }).whereNull('deleted_at').forUpdate().first();

export const markUserEmailVerified = async (transaction: Knex.Transaction, userId: string): Promise<void> => {
  await transaction('users').where({ id: userId }).whereNull('deleted_at').update({ is_email_verified: true, updated_at: transaction.fn.now() });
};

export const softDeleteUser = async (id: string): Promise<boolean> =>
  getDatabase().transaction(async (transaction) => {
    const affected = await transaction('users')
      .where({ id })
      .whereNull('deleted_at')
      .update({ deleted_at: transaction.fn.now(), updated_at: transaction.fn.now() }) as unknown as number;
    if (affected !== 1) return false;
    await transaction('user_details')
      .where({ user_id: id })
      .whereNull('deleted_at')
      .update({ deleted_at: transaction.fn.now() });
    return true;
  });

export interface CreateRegisteredUserInput {
  readonly id: string;
  readonly name: string;
  readonly email: string;
  readonly password_hash: string;
  readonly is_email_verified: boolean;
  readonly roleId: number;
  readonly verificationOtp: Omit<CreateEmailVerificationOtpInput, 'user_id'>;
}

export class MissingRoleError extends Error {
  public constructor(roleIdentifier: string) {
    super(`Required role is missing: ${roleIdentifier}`);
    this.name = 'MissingRoleError';
  }
}

export const isMissingRoleError = (error: unknown): error is MissingRoleError => error instanceof MissingRoleError;

export const createRegisteredUser = async (input: CreateRegisteredUserInput): Promise<UserRecord> =>
  getDatabase().transaction(async (transaction) => {
    const role = await transaction<RoleRecord>('roles').select('id', 'name', 'deleted_at').where({ id: input.roleId }).whereNull('deleted_at').first();
    if (!role) throw new MissingRoleError(String(input.roleId));

    const rows = await transaction<UserRecord>('users')
      .insert({ id: input.id, name: input.name, email: input.email, password_hash: input.password_hash, is_email_verified: input.is_email_verified })
      .returning(['id', 'name', 'email', 'password_hash', 'is_email_verified', 'created_at', 'updated_at']);
    const user = rows[0];
    if (!user) throw new Error('User insert did not return a row.');

    await transaction('user_roles').insert({ user_id: user.id, role_id: input.roleId });
    await insertEmailVerificationOtp(transaction, { user_id: user.id, ...input.verificationOtp });
    return user;
  });

export const isUniqueEmailError = (error: unknown): boolean => {
  const candidate = error as { code?: string; constraint?: string };
  return candidate.code === '23505' && candidate.constraint === 'users_email_unique';
};

export type UserQuery = Knex.QueryBuilder<UserRecord, UserRecord[]>;
