import type { Knex } from 'knex';
import { getDatabase } from '../config/database';

export interface OrganizerRecord {
  readonly id: string;
  readonly name: string;
  readonly user_id: string | null;
  readonly community_id: string | null;
  readonly logo_url: string | null;
  readonly email: string | null;
  readonly phone: string | null;
  readonly created_at: Date;
  readonly updated_at: Date;
}

export interface OrganizerCreateValues {
  readonly id: string;
  readonly name: string;
  readonly user_id: string | null;
  readonly community_id: string | null;
  readonly logo_url: string | null;
  readonly email: string | null;
  readonly phone: string | null;
}

export interface OrganizerUpdateValues {
  readonly name?: string;
  readonly user_id?: string | null;
  readonly community_id?: string | null;
  readonly logo_url?: string | null;
  readonly email?: string | null;
  readonly phone?: string | null;
}

export class OrganizerUserNotFoundError extends Error {
  public constructor() {
    super('User is not active');
    this.name = 'OrganizerUserNotFoundError';
  }
}

export class OrganizerCommunityNotFoundError extends Error {
  public constructor() {
    super('Community is not active');
    this.name = 'OrganizerCommunityNotFoundError';
  }
}

const isForeignKeyError = (error: unknown, constraint: string): boolean => {
  const candidate = error as { code?: string; constraint?: string };
  return candidate.code === '23503' && candidate.constraint === constraint;
};

export const isOrganizerUserForeignKeyError = (error: unknown): boolean => isForeignKeyError(error, 'organizers_user_id_foreign');

export const isOrganizerCommunityForeignKeyError = (error: unknown): boolean => isForeignKeyError(error, 'organizers_community_id_foreign');

const organizerColumns = [
  'id',
  'name',
  'user_id',
  'community_id',
  'logo_url',
  'email',
  'phone',
  'created_at',
  'updated_at',
] as const;

const selectOrganizerColumns = (query: Knex.QueryBuilder): Knex.QueryBuilder => query.select(...organizerColumns);

export const validateOrganizerReferences = async (
  transaction: Knex.Transaction,
  references: { readonly user_id: string | null; readonly community_id: string | null },
): Promise<void> => {
  if (references.user_id !== null) {
    const user = await transaction('users')
      .select('id')
      .where({ id: references.user_id })
      .whereNull('deleted_at')
      .forUpdate()
      .first();
    if (!user) throw new OrganizerUserNotFoundError();
  }

  if (references.community_id !== null) {
    const community = await transaction('communities')
      .select('id')
      .where({ id: references.community_id })
      .whereNull('deleted_at')
      .forUpdate()
      .first();
    if (!community) throw new OrganizerCommunityNotFoundError();
  }
};

export const findOrganizerForUpdate = async (transaction: Knex.Transaction, organizerId: string): Promise<OrganizerRecord | undefined> =>
  selectOrganizerColumns(transaction<OrganizerRecord>('organizers'))
    .where({ id: organizerId })
    .whereNull('deleted_at')
    .forUpdate()
    .first() as Promise<OrganizerRecord | undefined>;

export const insertOrganizer = async (transaction: Knex.Transaction, values: OrganizerCreateValues): Promise<OrganizerRecord> => {
  const rows = await transaction<OrganizerRecord>('organizers')
    .insert(values)
    .returning([...organizerColumns]);
  const organizer = rows[0];
  if (!organizer) throw new Error('Organizer insert did not return a row.');
  return organizer;
};

export const updateOrganizer = async (transaction: Knex.Transaction, organizerId: string, values: OrganizerUpdateValues): Promise<OrganizerRecord> => {
  const rows = await transaction<OrganizerRecord>('organizers')
    .where({ id: organizerId })
    .update({ ...values, updated_at: transaction.fn.now() })
    .returning([...organizerColumns]);
  const organizer = rows[0];
  if (!organizer) throw new Error('Organizer update did not return a row.');
  return organizer;
};

export const softDeleteOrganizer = async (transaction: Knex.Transaction, organizerId: string): Promise<void> => {
  await transaction('organizers')
    .where({ id: organizerId })
    .whereNull('deleted_at')
    .update({ deleted_at: transaction.fn.now(), updated_at: transaction.fn.now() });
};
