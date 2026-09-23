import type { CityRecord } from '../models/province.model';

export interface PublicCity {
  readonly id: number;
  readonly provinceId: number;
  readonly name: string;
  readonly createdAt: string;
}

export const presentCity = (city: CityRecord): PublicCity => ({
  id: city.id,
  provinceId: city.province_id,
  name: city.name,
  createdAt: new Date(city.created_at).toISOString(),
});
