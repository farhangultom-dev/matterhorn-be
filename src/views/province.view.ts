import type { ProvinceRecord } from '../models/province.model';

export interface PublicProvince {
  readonly id: number;
  readonly name: string;
  readonly createdAt: string;
}

export const presentProvince = (province: ProvinceRecord): PublicProvince => ({
  id: province.id,
  name: province.name,
  createdAt: new Date(province.created_at).toISOString(),
});
