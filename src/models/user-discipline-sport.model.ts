import { getDatabase } from '../config/database';

export interface UserDisciplineSportRecord {
  readonly id: number;
  readonly discipline_sport_id: number;
  readonly discipline_sport_name: string;
  readonly city_name: string | null;
}

export const findActiveUserDisciplineSportsByUserId = async (userId: string): Promise<readonly UserDisciplineSportRecord[]> =>
  getDatabase()<UserDisciplineSportRecord>('user_discipline_sports as uds')
    .join('discipline_sports as ds', 'ds.id', 'uds.discipline_sport_id')
    .leftJoin('user_details as ud', function joinActiveUserDetails() {
      this.on('ud.user_id', '=', 'uds.user_id').andOnNull('ud.deleted_at');
    })
    .leftJoin('cities as c', function joinActiveCity() {
      this.on('c.id', '=', 'ud.city_id').andOnNull('c.deleted_at');
    })
    .select('uds.id', 'uds.discipline_sport_id', 'ds.name as discipline_sport_name', 'c.name as city_name')
    .where('uds.user_id', userId)
    .whereNull('uds.deleted_at')
    .whereNull('ds.deleted_at')
    .orderBy('ds.name', 'asc');
