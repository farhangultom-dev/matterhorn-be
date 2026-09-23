import { Router } from 'express';
import { createOrganizerController, deleteOrganizerController, updateOrganizerController } from '../controllers/organizer.controller';
import { authenticate } from '../middlewares/authenticate.middleware';
import { parseOrganizerCreate } from '../middlewares/organizer-logo-upload.middleware';
import { validateBody, validateParams } from '../middlewares/validate.middleware';
import { organizerIdParamsSchema, updateOrganizerSchema } from '../validations/organizer.validation';

const router = Router();

router.post('/', authenticate, parseOrganizerCreate, createOrganizerController);
router.patch('/:organizerId', authenticate, validateParams(organizerIdParamsSchema), validateBody(updateOrganizerSchema), updateOrganizerController);
router.delete('/:organizerId', authenticate, validateParams(organizerIdParamsSchema), deleteOrganizerController);

export default router;
