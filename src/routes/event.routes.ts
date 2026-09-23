import { Router } from 'express';
import { createEventController, deleteEventController, getEventController, listEventsController, updateEventController } from '../controllers/event.controller';
import { authenticate } from '../middlewares/authenticate.middleware';
import { parseEventCreateRequest } from '../middlewares/event-poster-upload.middleware';
import { validateBody, validateParams, validateQuery } from '../middlewares/validate.middleware';
import { createEventSchema, eventIdParamsSchema, listEventsQuerySchema, updateEventSchema } from '../validations/event.validation';

const router = Router();

router.get('/', validateQuery(listEventsQuerySchema), listEventsController);
router.get('/:eventId', validateParams(eventIdParamsSchema), getEventController);
router.post('/', authenticate, parseEventCreateRequest, createEventController);
router.patch('/:eventId', authenticate, validateParams(eventIdParamsSchema), validateBody(updateEventSchema), updateEventController);
router.delete('/:eventId', authenticate, validateParams(eventIdParamsSchema), deleteEventController);

export default router;
