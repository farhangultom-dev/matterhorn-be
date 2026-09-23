import { getDatabase } from '../config/database';

export interface ProvinceRecord {
  readonly id: number;
  readonly name: string;
  readonly created_at: Date;
}

export interface CityRecord {
  readonly id: number;
  readonly province_id: number;
  readonly name: string;
  readonly created_at: Date;
}

export const findActiveProvinces = async (): Promise<ProvinceRecord[]> =>
  getDatabase()<ProvinceRecord>('provinces')
    .select('id', 'name', 'created_at')
    .whereNull('deleted_at')
    .orderBy([{ column: 'name', order: 'asc' }, { column: 'id', order: 'asc' }]);

export const findActiveProvinceById = async (provinceId: number): Promise<ProvinceRecord | undefined> =>
  getDatabase()<ProvinceRecord>('provinces')
    .select('id', 'name', 'created_at')
    .where({ id: provinceId })
    .whereNull('deleted_at')
    .first();

export const findActiveCitiesByProvinceId = async (provinceId: number): Promise<CityRecord[]> =>
  getDatabase()<CityRecord>('cities')
    .select('id', 'province_id', 'name', 'created_at')
    .where({ province_id: provinceId })
    .whereNull('deleted_at')
    .orderBy([{ column: 'name', order: 'asc' }, { column: 'id', order: 'asc' }]);
