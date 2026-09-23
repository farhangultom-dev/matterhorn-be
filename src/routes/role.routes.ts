import { Router } from 'express';
import { getRolesController } from '../controllers/role.controller';

const router = Router();
router.get('/', getRolesController);

export default router;
