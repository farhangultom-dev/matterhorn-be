import { Router } from 'express';
import { authenticate } from '../middlewares/authenticate.middleware';
import { validateBody } from '../middlewares/validate.middleware';
import { createUserRoleController } from '../controllers/user-role.controller';
import { createUserRoleSchema } from '../validations/user-role.validation';

const router = Router();
router.post('/', authenticate, validateBody(createUserRoleSchema), createUserRoleController);

export default router;
