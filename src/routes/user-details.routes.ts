import { Router } from 'express';
import { deleteCurrentUserController, updateUserDetailsController } from '../controllers/user-details.controller';
import { addUserDisciplineSportController } from '../controllers/user-discipline-sport.controller';
import { authenticate } from '../middlewares/authenticate.middleware';
import { parseUserDetailsUpdate } from '../middlewares/profile-photo-upload.middleware';
import { validateBody } from '../middlewares/validate.middleware';
import { addUserDisciplineSportSchema } from '../validations/user-discipline-sport.validation';

const router = Router();
router.delete('/me', authenticate, deleteCurrentUserController);
router.patch('/me/details', authenticate, parseUserDetailsUpdate, updateUserDetailsController);
router.post('/me/discipline-sports', authenticate, validateBody(addUserDisciplineSportSchema), addUserDisciplineSportController);

export default router;
