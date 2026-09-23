import { findActiveCitiesByProvinceId, findActiveProvinceById, findActiveProvinces, type CityRecord, type ProvinceRecord } from '../models/province.model';
import { AppError } from '../utils/app-error';

export const getAllProvinces = async (): Promise<ProvinceRecord[]> => findActiveProvinces();

export const getCitiesByProvinceId = async (provinceId: number): Promise<CityRecord[]> => {
  const province = await findActiveProvinceById(provinceId);
  if (!province) throw new AppError(404, 'PROVINCE_NOT_FOUND', 'Province not found');
  return findActiveCitiesByProvinceId(provinceId);
};
