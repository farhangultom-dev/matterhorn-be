import { Router } from 'express';
import { getCitiesByProvinceController, getProvincesController } from '../controllers/province.controller';

const router = Router();
router.get('/', getProvincesController);
router.get('/:provinceId/cities', getCitiesByProvinceController);

export default router;
