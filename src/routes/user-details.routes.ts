import { Router } from 'express';
import { deleteCurrentUserController, updateUserDetailsController } from '../controllers/user-details.controller';
import { authenticate } from '../middlewares/authenticate.middleware';
import { parseUserDetailsUpdate } from '../middlewares/profile-photo-upload.middleware';

const router = Router();
router.delete('/me', authenticate, deleteCurrentUserController);
router.patch('/me/details', authenticate, parseUserDetailsUpdate, updateUserDetailsController);

export default router;
