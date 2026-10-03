import { Router } from 'express';
import { createOrganizerController, deleteOrganizerController, listOrganizerEventsController, updateOrganizerController } from '../controllers/organizer.controller';
import { authenticate } from '../middlewares/authenticate.middleware';
import { parseOrganizerCreate } from '../middlewares/organizer-logo-upload.middleware';
import { validateBody, validateParams, validateQuery } from '../middlewares/validate.middleware';
import { listOrganizerEventsQuerySchema } from '../validations/event.validation';
import { organizerIdParamsSchema, updateOrganizerSchema } from '../validations/organizer.validation';

const router = Router();

router.post('/', authenticate, parseOrganizerCreate, createOrganizerController);
router.get('/:organizerId/events', validateParams(organizerIdParamsSchema), validateQuery(listOrganizerEventsQuerySchema), listOrganizerEventsController);
router.patch('/:organizerId', authenticate, validateParams(organizerIdParamsSchema), validateBody(updateOrganizerSchema), updateOrganizerController);
router.delete('/:organizerId', authenticate, validateParams(organizerIdParamsSchema), deleteOrganizerController);

export default router;
