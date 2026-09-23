import type { Knex } from 'knex';
import { getDatabase } from '../config/database';
import type { CommunityRecord } from './community.model';

export interface CommunityDisciplineSportRecord {
  readonly id: number;
  readonly community_id: string;
  readonly discipline_sport_id: number;
  readonly discipline_sport_name: string;
  readonly created_at: Date;
}

export class CommunityDisciplineSportAlreadyExistsError extends Error {
  public constructor() {
    super('Community already has this discipline sport');
    this.name = 'CommunityDisciplineSportAlreadyExistsError';
  }
}

export class DisciplineSportNotFoundError extends Error {
  public constructor() {
    super('Discipline sport is not active');
    this.name = 'DisciplineSportNotFoundError';
  }
}

export class CommunityPrimaryLocationAlreadyExistsError extends Error {
  public constructor() {
    super('Community already has an active primary location');
    this.name = 'CommunityPrimaryLocationAlreadyExistsError';
  }
}

export class CommunityLocationCityNotFoundError extends Error {
  public constructor() {
    super('City is not active or does not belong to an active province');
    this.name = 'CommunityLocationCityNotFoundError';
  }
}

export class CommunityScheduleAlreadyExistsError extends Error {
  public constructor() {
    super('Community already has this schedule');
    this.name = 'CommunityScheduleAlreadyExistsError';
  }
}

export class CommunityScheduleLocationNotFoundError extends Error {
  public constructor() {
    super('Schedule location is not active or does not belong to this community');
    this.name = 'CommunityScheduleLocationNotFoundError';
  }
}

export class CommunitySocialLinkAlreadyExistsError extends Error {
  public constructor() {
    super('Community already has a social link for this platform');
    this.name = 'CommunitySocialLinkAlreadyExistsError';
  }
}

export interface CommunityLocationRecord {
  readonly id: number;
  readonly community_id: string;
  readonly city_id: number | null;
  readonly url_gmaps_locations: string | null;
  readonly is_primary: boolean;
  readonly created_at: Date;
}

export interface CommunityScheduleRecord {
  readonly id: number;
  readonly community_id: string;
  readonly day_of_week: number;
  readonly start_time: string;
  readonly end_time: string;
  readonly location_id: number | null;
  readonly created_at: Date;
}

export interface CommunitySocialLinkRecord {
  readonly id: number;
  readonly community_id: string;
  readonly platform: string;
  readonly url: string;
  readonly created_at: Date;
}

export interface CommunityRelations {
  readonly disciplineSports: CommunityDisciplineSportRecord[];
  readonly locations: CommunityLocationRecord[];
  readonly schedules: CommunityScheduleRecord[];
  readonly socialLinks: CommunitySocialLinkRecord[];
}

export interface CommunityWithRelations extends CommunityRecord {
  readonly relations: CommunityRelations;
}

const emptyRelations = (): CommunityRelations => ({ disciplineSports: [], locations: [], schedules: [], socialLinks: [] });

const selectCommunityDisciplineSport = (query: Knex.QueryBuilder): Knex.QueryBuilder => query
  .join('discipline_sports as ds', 'ds.id', 'cds.discipline_sport_id')
  .select('cds.id', 'cds.community_id', 'cds.discipline_sport_id', 'ds.name as discipline_sport_name', 'cds.created_at');

export const insertCommunityDisciplineSport = async (
  transaction: Knex.Transaction,
  communityId: string,
  disciplineSportId: number,
): Promise<CommunityDisciplineSportRecord> => {
  const disciplineSport = await transaction('discipline_sports')
    .select('id')
    .where({ id: disciplineSportId })
    .whereNull('deleted_at')
    .first();
  if (!disciplineSport) throw new DisciplineSportNotFoundError();

  const existing = await transaction('community_discipline_sports')
    .select('id', 'deleted_at')
    .where({ community_id: communityId, discipline_sport_id: disciplineSportId })
    .forUpdate()
    .first();
  if (existing?.deleted_at) {
    await transaction('community_discipline_sports')
      .where({ id: existing.id })
      .update({ deleted_at: null });
  } else if (existing) {
    throw new CommunityDisciplineSportAlreadyExistsError();
  } else {
    await transaction('community_discipline_sports').insert({
      community_id: communityId,
      discipline_sport_id: disciplineSportId,
    });
  }

  const row = await selectCommunityDisciplineSport(transaction<CommunityDisciplineSportRecord>('community_discipline_sports as cds'))
    .where('cds.community_id', communityId)
    .where('cds.discipline_sport_id', disciplineSportId)
    .whereNull('cds.deleted_at')
    .whereNull('ds.deleted_at')
    .first();
  if (!row) throw new Error('Community discipline sport insert did not return a row.');
  return row as CommunityDisciplineSportRecord;
};

export interface CommunityLocationInsertValues {
  readonly city_id: number | null;
  readonly url_gmaps_locations: string | null;
  readonly is_primary: boolean;
}

export const insertCommunityLocation = async (
  transaction: Knex.Transaction,
  communityId: string,
  values: CommunityLocationInsertValues,
): Promise<CommunityLocationRecord> => {
  if (values.city_id !== null) {
    const city = await transaction('cities')
      .join('provinces', 'provinces.id', 'cities.province_id')
      .select('cities.id')
      .where('cities.id', values.city_id)
      .whereNull('cities.deleted_at')
      .whereNull('provinces.deleted_at')
      .first();
    if (!city) throw new CommunityLocationCityNotFoundError();
  }

  if (values.is_primary) {
    const primary = await transaction('community_locations')
      .select('id')
      .where({ community_id: communityId, is_primary: true })
      .whereNull('deleted_at')
      .forUpdate()
      .first();
    if (primary) throw new CommunityPrimaryLocationAlreadyExistsError();
  }

  const rows = await transaction<CommunityLocationRecord>('community_locations')
    .insert({ community_id: communityId, ...values })
    .returning(['id', 'community_id', 'city_id', 'url_gmaps_locations', 'is_primary', 'created_at']);
  const location = rows[0];
  if (!location) throw new Error('Community location insert did not return a row.');
  return location;
};

export const isUniqueCommunityPrimaryLocationError = (error: unknown): boolean => {
  const candidate = error as { code?: string; constraint?: string };
  return candidate.code === '23505' && candidate.constraint === 'community_locations_one_active_primary_unique';
};

export interface CommunityScheduleInsertValues {
  readonly day_of_week: number;
  readonly start_time: string;
  readonly end_time: string;
  readonly location_id: number | null;
}

export const insertCommunitySchedule = async (
  transaction: Knex.Transaction,
  communityId: string,
  values: CommunityScheduleInsertValues,
): Promise<CommunityScheduleRecord> => {
  if (values.location_id !== null) {
    const location = await transaction('community_locations')
      .select('id')
      .where({ id: values.location_id, community_id: communityId })
      .whereNull('deleted_at')
      .first();
    if (!location) throw new CommunityScheduleLocationNotFoundError();
  }

  const existingQuery = transaction('community_schedules')
    .select('id', 'deleted_at')
    .where({
      community_id: communityId,
      day_of_week: values.day_of_week,
      start_time: values.start_time,
      end_time: values.end_time,
    });
  if (values.location_id === null) existingQuery.whereNull('location_id');
  else existingQuery.where('location_id', values.location_id);
  const existing = await existingQuery.forUpdate().first();

  if (existing?.deleted_at) {
    await transaction('community_schedules').where({ id: existing.id }).update({ deleted_at: null });
  } else if (existing) {
    throw new CommunityScheduleAlreadyExistsError();
  } else {
    try {
      await transaction('community_schedules').insert({ community_id: communityId, ...values });
    } catch (error) {
      if (isUniqueCommunityScheduleError(error)) throw new CommunityScheduleAlreadyExistsError();
      throw error;
    }
  }

  const row = await transaction<CommunityScheduleRecord>('community_schedules')
    .select('id', 'community_id', 'day_of_week', 'start_time', 'end_time', 'location_id', 'created_at')
    .where({
      community_id: communityId,
      day_of_week: values.day_of_week,
      start_time: values.start_time,
      end_time: values.end_time,
    })
    .whereNull('deleted_at')
    .modify((query) => {
      if (values.location_id === null) query.whereNull('location_id');
      else query.where('location_id', values.location_id);
    })
    .first();
  if (!row) throw new Error('Community schedule insert did not return a row.');
  return row;
};

export const isUniqueCommunityScheduleError = (error: unknown): boolean => {
  const candidate = error as { code?: string; constraint?: string };
  return candidate.code === '23505' && candidate.constraint === 'community_schedules_unique_slot';
};

export interface CommunitySocialLinkInsertValues {
  readonly platform: string;
  readonly url: string;
}

export const insertCommunitySocialLink = async (
  transaction: Knex.Transaction,
  communityId: string,
  values: CommunitySocialLinkInsertValues,
): Promise<CommunitySocialLinkRecord> => {
  const existing = await transaction('community_social_links')
    .select('id', 'deleted_at')
    .where({ community_id: communityId, platform: values.platform })
    .forUpdate()
    .first();

  if (existing?.deleted_at) {
    await transaction('community_social_links')
      .where({ id: existing.id })
      .update({ url: values.url, deleted_at: null });
  } else if (existing) {
    throw new CommunitySocialLinkAlreadyExistsError();
  } else {
    try {
      await transaction('community_social_links').insert({ community_id: communityId, ...values });
    } catch (error) {
      if (isUniqueCommunitySocialLinkError(error)) throw new CommunitySocialLinkAlreadyExistsError();
      throw error;
    }
  }

  const row = await transaction<CommunitySocialLinkRecord>('community_social_links')
    .select('id', 'community_id', 'platform', 'url', 'created_at')
    .where({ community_id: communityId, platform: values.platform })
    .whereNull('deleted_at')
    .first();
  if (!row) throw new Error('Community social link insert did not return a row.');
  return row;
};

export const isUniqueCommunitySocialLinkError = (error: unknown): boolean => {
  const candidate = error as { code?: string; constraint?: string };
  return candidate.code === '23505' && candidate.constraint === 'community_social_links_community_id_platform_unique';
};

export const findCommunityRelations = async (communityIds: readonly string[]): Promise<Map<string, CommunityRelations>> => {
  const relationsByCommunity = new Map<string, {
    disciplineSports: CommunityDisciplineSportRecord[];
    locations: CommunityLocationRecord[];
    schedules: CommunityScheduleRecord[];
    socialLinks: CommunitySocialLinkRecord[];
  }>();
  for (const communityId of communityIds) relationsByCommunity.set(communityId, emptyRelations());
  if (communityIds.length === 0) return relationsByCommunity;

  const database = getDatabase();
  const [disciplineSports, locations, schedules, socialLinks] = await Promise.all([
    database<CommunityDisciplineSportRecord>('community_discipline_sports as cds')
      .join('discipline_sports as ds', 'ds.id', 'cds.discipline_sport_id')
      .select('cds.id', 'cds.community_id', 'cds.discipline_sport_id', 'ds.name as discipline_sport_name', 'cds.created_at')
      .whereIn('cds.community_id', communityIds)
      .whereNull('cds.deleted_at')
      .whereNull('ds.deleted_at')
      .orderBy([{ column: 'ds.name', order: 'asc' }, { column: 'cds.id', order: 'asc' }]),
    database<CommunityLocationRecord>('community_locations')
      .select('id', 'community_id', 'city_id', 'url_gmaps_locations', 'is_primary', 'created_at')
      .whereIn('community_id', communityIds)
      .whereNull('deleted_at')
      .orderBy([{ column: 'is_primary', order: 'desc' }, { column: 'id', order: 'asc' }]),
    database<CommunityScheduleRecord>('community_schedules')
      .select('id', 'community_id', 'day_of_week', 'start_time', 'end_time', 'location_id', 'created_at')
      .whereIn('community_id', communityIds)
      .whereNull('deleted_at')
      .orderBy([{ column: 'day_of_week', order: 'asc' }, { column: 'start_time', order: 'asc' }, { column: 'id', order: 'asc' }]),
    database<CommunitySocialLinkRecord>('community_social_links')
      .select('id', 'community_id', 'platform', 'url', 'created_at')
      .whereIn('community_id', communityIds)
      .whereNull('deleted_at')
      .orderBy([{ column: 'platform', order: 'asc' }, { column: 'id', order: 'asc' }]),
  ]);

  for (const row of disciplineSports) relationsByCommunity.get(row.community_id)?.disciplineSports.push(row);
  for (const row of locations) relationsByCommunity.get(row.community_id)?.locations.push(row);
  for (const row of schedules) relationsByCommunity.get(row.community_id)?.schedules.push(row);
  for (const row of socialLinks) relationsByCommunity.get(row.community_id)?.socialLinks.push(row);
  return relationsByCommunity;
};
