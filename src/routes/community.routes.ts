import { Router } from 'express';
import { addCommunityDisciplineSportController, addCommunityLocationController, addCommunityScheduleController, addCommunitySocialLinkController, listCommunitiesController, getCommunityController, createCommunityController, deleteCommunityController, updateCommunityController, updateCommunityCoverController, updateCommunityLogoController } from '../controllers/community.controller';
import { authenticate } from '../middlewares/authenticate.middleware';
import { parseCommunityCoverUpload, parseCommunityLogoUpload } from '../middlewares/community-media-upload.middleware';
import { validateBody, validateParams, validateQuery } from '../middlewares/validate.middleware';
import { addCommunityDisciplineSportSchema, addCommunityLocationSchema, addCommunityScheduleSchema, addCommunitySocialLinkSchema, communityIdParamsSchema, createCommunitySchema, listCommunitiesQuerySchema, updateCommunitySchema } from '../validations/community.validation';

const router = Router();
router.get('/', validateQuery(listCommunitiesQuerySchema), listCommunitiesController);
router.get('/:communityId', validateParams(communityIdParamsSchema), getCommunityController);
router.post('/', authenticate, validateBody(createCommunitySchema), createCommunityController);
router.patch('/:communityId/logo', authenticate, validateParams(communityIdParamsSchema), parseCommunityLogoUpload, updateCommunityLogoController);
router.patch('/:communityId/cover', authenticate, validateParams(communityIdParamsSchema), parseCommunityCoverUpload, updateCommunityCoverController);
// POST aliases keep multipart clients that use create-style upload semantics compatible.
router.post('/:communityId/logo', authenticate, validateParams(communityIdParamsSchema), parseCommunityLogoUpload, updateCommunityLogoController);
router.post('/:communityId/cover', authenticate, validateParams(communityIdParamsSchema), parseCommunityCoverUpload, updateCommunityCoverController);
router.post('/:communityId/discipline-sports', authenticate, validateParams(communityIdParamsSchema), validateBody(addCommunityDisciplineSportSchema), addCommunityDisciplineSportController);
router.post('/:communityId/locations', authenticate, validateParams(communityIdParamsSchema), validateBody(addCommunityLocationSchema), addCommunityLocationController);
router.post('/:communityId/schedules', authenticate, validateParams(communityIdParamsSchema), validateBody(addCommunityScheduleSchema), addCommunityScheduleController);
router.post('/:communityId/social-links', authenticate, validateParams(communityIdParamsSchema), validateBody(addCommunitySocialLinkSchema), addCommunitySocialLinkController);
router.patch('/:communityId', authenticate, validateParams(communityIdParamsSchema), validateBody(updateCommunitySchema), updateCommunityController);
router.delete('/:communityId', authenticate, validateParams(communityIdParamsSchema), deleteCommunityController);

export default router;
