import type { RequestHandler } from 'express';
import { addCommunityDisciplineSport, addCommunityLocation, addCommunitySchedule, addCommunitySocialLink, createCommunity, deleteCommunity, getPublicCommunity, listPublicCommunities, updateCommunity, updateCommunityCover, updateCommunityLogo } from '../services/community.service';
import type { AddCommunityDisciplineSportInput, AddCommunityLocationInput, AddCommunityScheduleInput, AddCommunitySocialLinkInput, CommunityIdParams, CreateCommunityInput, ListCommunitiesQuery, UpdateCommunityInput } from '../validations/community.validation';
import type { CommunityMediaFile } from '../services/community-media-storage.service';
import { successResponse } from '../views/response.view';
import { presentCommunity } from '../views/community.view';
import { presentCommunityDisciplineSport, presentCommunityLocation, presentCommunitySchedule, presentCommunitySocialLink } from '../views/community-relation.view';

export const listCommunitiesController: RequestHandler = async (_request, response) => {
  const result = await listPublicCommunities(response.locals.validatedQuery as ListCommunitiesQuery);
  const filters = response.locals.validatedQuery as ListCommunitiesQuery;
  response.json(successResponse('Communities retrieved', {
    communities: result.rows.map(presentCommunity),
    pagination: {
      page: filters.page,
      limit: filters.limit,
      total: result.total,
      totalPages: result.total === 0 ? 0 : Math.ceil(result.total / filters.limit),
    },
  }));
};

export const getCommunityController: RequestHandler = async (_request, response) => {
  const { communityId } = response.locals.validatedParams as CommunityIdParams;
  const community = await getPublicCommunity(communityId);
  response.json(successResponse('Community retrieved', { community: presentCommunity(community) }));
};

export const createCommunityController: RequestHandler = async (request, response) => {
  const community = await createCommunity(request.auth!.userId, response.locals.validatedBody as CreateCommunityInput);
  response.status(201).json(successResponse('Community created', { community: presentCommunity(community) }));
};

export const updateCommunityController: RequestHandler = async (request, response) => {
  const { communityId } = response.locals.validatedParams as CommunityIdParams;
  const community = await updateCommunity(request.auth!.userId, communityId, response.locals.validatedBody as UpdateCommunityInput);
  response.json(successResponse('Community updated', { community: presentCommunity(community) }));
};

export const updateCommunityLogoController: RequestHandler = async (request, response) => {
  const { communityId } = response.locals.validatedParams as CommunityIdParams;
  const community = await updateCommunityLogo(request.auth!.userId, communityId, response.locals.communityMediaFile as CommunityMediaFile);
  response.json(successResponse('Community logo updated', { community: presentCommunity(community) }));
};

export const updateCommunityCoverController: RequestHandler = async (request, response) => {
  const { communityId } = response.locals.validatedParams as CommunityIdParams;
  const community = await updateCommunityCover(request.auth!.userId, communityId, response.locals.communityMediaFile as CommunityMediaFile);
  response.json(successResponse('Community cover updated', { community: presentCommunity(community) }));
};

export const addCommunityDisciplineSportController: RequestHandler = async (request, response) => {
  const { communityId } = response.locals.validatedParams as CommunityIdParams;
  const relation = await addCommunityDisciplineSport(request.auth!.userId, communityId, response.locals.validatedBody as AddCommunityDisciplineSportInput);
  response.status(201).json(successResponse('Community discipline sport added', { communityDisciplineSport: presentCommunityDisciplineSport(relation) }));
};

export const addCommunityLocationController: RequestHandler = async (request, response) => {
  const { communityId } = response.locals.validatedParams as CommunityIdParams;
  const location = await addCommunityLocation(request.auth!.userId, communityId, response.locals.validatedBody as AddCommunityLocationInput);
  response.status(201).json(successResponse('Community location added', { communityLocation: presentCommunityLocation(location) }));
};

export const addCommunityScheduleController: RequestHandler = async (request, response) => {
  const { communityId } = response.locals.validatedParams as CommunityIdParams;
  const schedule = await addCommunitySchedule(request.auth!.userId, communityId, response.locals.validatedBody as AddCommunityScheduleInput);
  response.status(201).json(successResponse('Community schedule added', { communitySchedule: presentCommunitySchedule(schedule) }));
};

export const addCommunitySocialLinkController: RequestHandler = async (request, response) => {
  const { communityId } = response.locals.validatedParams as CommunityIdParams;
  const socialLink = await addCommunitySocialLink(request.auth!.userId, communityId, response.locals.validatedBody as AddCommunitySocialLinkInput);
  response.status(201).json(successResponse('Community social link added', { communitySocialLink: presentCommunitySocialLink(socialLink) }));
};

export const deleteCommunityController: RequestHandler = async (request, response) => {
  const { communityId } = response.locals.validatedParams as CommunityIdParams;
  await deleteCommunity(request.auth!.userId, communityId);
  response.json(successResponse('Community deleted', { deleted: true }));
};
