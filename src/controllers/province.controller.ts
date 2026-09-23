import type { RequestHandler } from 'express';
import { getAllProvinces, getCitiesByProvinceId } from '../services/province.service';
import { AppError } from '../utils/app-error';
import { successResponse } from '../views/response.view';
import { presentProvince } from '../views/province.view';
import { presentCity } from '../views/city.view';

export const getProvincesController: RequestHandler = async (_request, response) => {
  const provinces = await getAllProvinces();
  response.json(successResponse('Provinces retrieved', { provinces: provinces.map(presentProvince) }));
};

export const getCitiesByProvinceController: RequestHandler = async (request, response) => {
  const rawProvinceId = request.params.provinceId;
  if (typeof rawProvinceId !== 'string' || !/^[1-9]\d*$/.test(rawProvinceId)) {
    throw new AppError(400, 'INVALID_PROVINCE_ID', 'Province ID must be a positive integer');
  }
  const provinceId = Number(rawProvinceId);
  if (!Number.isSafeInteger(provinceId)) {
    throw new AppError(400, 'INVALID_PROVINCE_ID', 'Province ID must be a positive integer');
  }
  const cities = await getCitiesByProvinceId(provinceId);
  response.json(successResponse('Cities retrieved', { cities: cities.map(presentCity) }));
};
