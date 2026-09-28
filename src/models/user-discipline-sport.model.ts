import type { Knex } from 'knex';
import { getDatabase } from '../config/database';

export interface UserDisciplineSportRecord {
  readonly id: number;
  readonly user_id: string;
  readonly discipline_sport_id: number;
  readonly discipline_sport_name: string;
  readonly city_name: string | null;
  readonly province_name: string | null;
  readonly created_at: Date;
}

export class UserDisciplineSportUserNotFoundError extends Error {
  public constructor() {
    super('User is not active');
    this.name = 'UserDisciplineSportUserNotFoundError';
  }
}

export class UserDisciplineSportNotFoundError extends Error {
  public constructor() {
    super('Discipline sport is not active');
    this.name = 'UserDisciplineSportNotFoundError';
  }
}

export class UserDisciplineSportAlreadyExistsError extends Error {
  public constructor() {
    super('User already has this discipline sport');
    this.name = 'UserDisciplineSportAlreadyExistsError';
  }
}

const selectUserDisciplineSport = (query: Knex.QueryBuilder): Knex.QueryBuilder => query
  .join('discipline_sports as ds', 'ds.id', 'uds.discipline_sport_id')
  .leftJoin('user_details as ud', function joinActiveUserDetails() {
    this.on('ud.user_id', '=', 'uds.user_id').andOnNull('ud.deleted_at');
  })
  .leftJoin('cities as c', function joinActiveCity() {
    this.on('c.id', '=', 'ud.city_id').andOnNull('c.deleted_at');
  })
  .leftJoin('provinces as p', function joinActiveProvince() {
    this.on('p.id', '=', 'c.province_id').andOnNull('p.deleted_at');
  })
  .select('uds.id', 'uds.user_id', 'uds.discipline_sport_id', 'ds.name as discipline_sport_name', 'c.name as city_name', 'p.name as province_name', 'uds.created_at');

export const findActiveUserDisciplineSportsByUserId = async (userId: string): Promise<readonly UserDisciplineSportRecord[]> =>
  selectUserDisciplineSport(getDatabase()<UserDisciplineSportRecord>('user_discipline_sports as uds'))
    .where('uds.user_id', userId)
    .whereNull('uds.deleted_at')
    .whereNull('ds.deleted_at')
    .orderBy('ds.name', 'asc');

export const insertUserDisciplineSport = async (
  transaction: Knex.Transaction,
  userId: string,
  disciplineSportId: number,
): Promise<UserDisciplineSportRecord> => {
  const user = await transaction('users').select('id').where({ id: userId }).whereNull('deleted_at').forUpdate().first();
  if (!user) throw new UserDisciplineSportUserNotFoundError();

  const sport = await transaction('discipline_sports')
    .select('id')
    .where({ id: disciplineSportId })
    .whereNull('deleted_at')
    .first();
  if (!sport) throw new UserDisciplineSportNotFoundError();

  const existing = await transaction('user_discipline_sports')
    .select('id', 'deleted_at')
    .where({ user_id: userId, discipline_sport_id: disciplineSportId })
    .forUpdate()
    .first();
  if (existing?.deleted_at) {
    await transaction('user_discipline_sports').where({ id: existing.id }).update({ deleted_at: null });
  } else if (existing) {
    throw new UserDisciplineSportAlreadyExistsError();
  } else {
    await transaction('user_discipline_sports').insert({ user_id: userId, discipline_sport_id: disciplineSportId });
  }

  const row = await selectUserDisciplineSport(transaction<UserDisciplineSportRecord>('user_discipline_sports as uds'))
    .where('uds.user_id', userId)
    .where('uds.discipline_sport_id', disciplineSportId)
    .whereNull('uds.deleted_at')
    .whereNull('ds.deleted_at')
    .first();
  if (!row) throw new Error('User discipline sport insert did not return a row.');
  return row as UserDisciplineSportRecord;
};
