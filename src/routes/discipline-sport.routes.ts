import { Router } from 'express';
import { getDisciplineSportsController } from '../controllers/discipline-sport.controller';

const router = Router();
router.get('/', getDisciplineSportsController);

export default router;
