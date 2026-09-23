import type { Knex } from 'knex';

export interface EmailVerificationOtpRecord {
  readonly user_id: string;
  readonly code_hash: string;
  readonly expires_at: Date;
  readonly sent_at: Date;
  readonly failed_attempts: number;
  readonly send_window_started_at: Date;
  readonly send_count: number;
  readonly created_at: Date;
}

export interface CreateEmailVerificationOtpInput {
  readonly user_id: string;
  readonly code_hash: string;
  readonly expires_at: Date;
  readonly sent_at: Date;
  readonly send_window_started_at: Date;
  readonly send_count: number;
}

export const insertEmailVerificationOtp = async (transaction: Knex.Transaction, input: CreateEmailVerificationOtpInput): Promise<void> => {
  await transaction<EmailVerificationOtpRecord>('user_email_verification_otps').insert(input);
};

export const findEmailVerificationOtpForUpdate = async (transaction: Knex.Transaction, userId: string): Promise<EmailVerificationOtpRecord | undefined> =>
  transaction<EmailVerificationOtpRecord>('user_email_verification_otps').where({ user_id: userId }).forUpdate().first();

export const updateEmailVerificationOtp = async (transaction: Knex.Transaction, userId: string, values: Partial<EmailVerificationOtpRecord>): Promise<void> => {
  await transaction('user_email_verification_otps').where({ user_id: userId }).update(values);
};

export const deleteEmailVerificationOtp = async (transaction: Knex.Transaction, userId: string): Promise<void> => {
  await transaction('user_email_verification_otps').where({ user_id: userId }).delete();
};

export const getDatabaseNow = async (database: Knex | Knex.Transaction): Promise<Date> => {
  const result = await database.raw('select now() as now') as { rows?: readonly [{ now: Date }] };
  const now = result.rows?.[0]?.now;
  if (!(now instanceof Date)) throw new Error('Database time was unavailable.');
  return now;
};
