import type { Knex } from 'knex';
import { getDatabase } from '../config/database';

export interface CommunityRecord {
  readonly id: string;
  readonly name: string;
  readonly slug: string;
  readonly description: string | null;
  readonly logo_url: string | null;
  readonly cover_url: string | null;
  readonly city_id: number | null;
  readonly owner_user_id: string | null;
  readonly visibility: 'public' | 'private';
  readonly status: 'draft' | 'active' | 'inactive' | 'suspended';
  readonly contact_person: string | null;
  readonly created_at: Date;
  readonly updated_at: Date;
}

export interface CommunityCreateValues {
  readonly id: string;
  readonly name: string;
  readonly slug: string;
  readonly description: string | null;
  readonly logo_url: string | null;
  readonly cover_url: string | null;
  readonly city_id: number | null;
  readonly owner_user_id: string;
  readonly visibility: 'public' | 'private';
  readonly status: 'draft';
  readonly contact_person: string | null;
}

export interface CommunityUpdateValues {
  readonly name?: string;
  readonly slug?: string;
  readonly description?: string | null;
  readonly logo_url?: string | null;
  readonly cover_url?: string | null;
  readonly city_id?: number | null;
  readonly visibility?: 'public' | 'private';
  readonly status?: 'draft' | 'active' | 'inactive' | 'suspended';
  readonly contact_person?: string | null;
}

export interface CommunityListFilters {
  readonly page: number;
  readonly limit: number;
  readonly search?: string;
  readonly cityId?: number;
  readonly disciplineSportId?: number;
}

export interface CommunityListResult {
  readonly rows: CommunityRecord[];
  readonly total: number;
}

type CommunityQuery = Knex.QueryBuilder<CommunityRecord, CommunityRecord[]>;

const selectCommunityColumns = (query: CommunityQuery): CommunityQuery =>
  query.select('id', 'name', 'slug', 'description', 'logo_url', 'cover_url', 'city_id', 'owner_user_id', 'visibility', 'status', 'contact_person', 'created_at', 'updated_at');

const escapeLikePattern = (value: string): string => value.replace(/[\\%_]/g, '\\$&');

const createPublicCommunityQuery = (): CommunityQuery =>
  getDatabase()<CommunityRecord>('communities')
    .whereNull('deleted_at')
    .where({ visibility: 'public', status: 'active' });

export const findPublicCommunities = async (filters: CommunityListFilters): Promise<CommunityListResult> => {
  const baseQuery = createPublicCommunityQuery();
  if (filters.search) {
    const pattern = `%${escapeLikePattern(filters.search)}%`;
    baseQuery.andWhere((query) => {
      query.whereRaw("name ILIKE ? ESCAPE '\\'", [pattern]).orWhereRaw("slug ILIKE ? ESCAPE '\\'", [pattern]);
    });
  }
  if (filters.cityId !== undefined) baseQuery.where({ city_id: filters.cityId });
  if (filters.disciplineSportId !== undefined) {
    baseQuery.whereExists(
      getDatabase()('community_discipline_sports as cds')
        .select('cds.id')
        .whereRaw('cds.community_id = communities.id')
        .where('cds.discipline_sport_id', filters.disciplineSportId)
        .whereNull('cds.deleted_at'),
    );
  }

  const countRow = await baseQuery.clone().count<{ count: string }>({ count: 'id' }).first();
  const rows = await selectCommunityColumns(baseQuery.clone())
    .orderBy([{ column: 'created_at', order: 'desc' }, { column: 'id', order: 'desc' }])
    .limit(filters.limit)
    .offset((filters.page - 1) * filters.limit);
  return { rows, total: Number(countRow?.count ?? 0) };
};

export const findPublicCommunityById = async (communityId: string): Promise<CommunityRecord | undefined> =>
  selectCommunityColumns(createPublicCommunityQuery()).where({ id: communityId }).first();

export const findCommunityForMediaAuthorization = async (communityId: string): Promise<CommunityRecord | undefined> =>
  selectCommunityColumns(getDatabase()<CommunityRecord>('communities')).where({ id: communityId }).whereNull('deleted_at').first();

export const findCommunityForUpdate = async (transaction: Knex.Transaction, communityId: string): Promise<CommunityRecord | undefined> =>
  selectCommunityColumns(transaction<CommunityRecord>('communities')).where({ id: communityId }).whereNull('deleted_at').forUpdate().first();

export const findActiveCityInTransaction = async (transaction: Knex.Transaction, cityId: number): Promise<boolean> => {
  const city = await transaction('cities')
    .join('provinces', 'provinces.id', 'cities.province_id')
    .select('cities.id')
    .where('cities.id', cityId)
    .whereNull('cities.deleted_at')
    .whereNull('provinces.deleted_at')
    .first();
  return city !== undefined;
};

export const insertCommunity = async (transaction: Knex.Transaction, values: CommunityCreateValues): Promise<CommunityRecord> => {
  const rows = await transaction<CommunityRecord>('communities')
    .insert(values)
    .returning(['id', 'name', 'slug', 'description', 'logo_url', 'cover_url', 'city_id', 'owner_user_id', 'visibility', 'status', 'contact_person', 'created_at', 'updated_at']);
  const community = rows[0];
  if (!community) throw new Error('Community insert did not return a row.');
  return community;
};

export const updateCommunity = async (transaction: Knex.Transaction, communityId: string, values: CommunityUpdateValues): Promise<CommunityRecord> => {
  const rows = await transaction<CommunityRecord>('communities')
    .where({ id: communityId })
    .update({ ...values, updated_at: transaction.fn.now() })
    .returning(['id', 'name', 'slug', 'description', 'logo_url', 'cover_url', 'city_id', 'owner_user_id', 'visibility', 'status', 'contact_person', 'created_at', 'updated_at']);
  const community = rows[0];
  if (!community) throw new Error('Community update did not return a row.');
  return community;
};

export const softDeleteCommunity = async (transaction: Knex.Transaction, communityId: string): Promise<void> => {
  await transaction('communities').where({ id: communityId }).update({ deleted_at: transaction.fn.now(), updated_at: transaction.fn.now() });
};

export const isUniqueCommunitySlugError = (error: unknown): boolean => {
  const candidate = error as { code?: string; constraint?: string };
  return candidate.code === '23505' && candidate.constraint === 'communities_slug_unique';
};
