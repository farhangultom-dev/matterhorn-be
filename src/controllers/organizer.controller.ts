import type { RequestHandler } from 'express';
import { createOrganizer, deleteOrganizer, updateOrganizer } from '../services/organizer.service';
import type { CreateOrganizerInput, OrganizerIdParams, UpdateOrganizerInput } from '../validations/organizer.validation';
import { successResponse } from '../views/response.view';
import { presentOrganizer } from '../views/organizer.view';
import type { OrganizerLogoFile } from '../services/organizer-logo-storage.service';
import { listPublicEvents } from '../services/event.service';
import type { ListOrganizerEventsQuery } from '../validations/event.validation';
import { presentEvent } from '../views/event.view';

export const createOrganizerController: RequestHandler = async (request, response) => {
  const organizer = await createOrganizer(request.auth!.userId, response.locals.validatedBody as CreateOrganizerInput, response.locals.organizerLogo as OrganizerLogoFile | undefined);
  response.status(201).json(successResponse('Organizer created', { organizer: presentOrganizer(organizer) }));
};

export const updateOrganizerController: RequestHandler = async (request, response) => {
  const { organizerId } = response.locals.validatedParams as OrganizerIdParams;
  const organizer = await updateOrganizer(request.auth!.userId, organizerId, response.locals.validatedBody as UpdateOrganizerInput);
  response.json(successResponse('Organizer updated', { organizer: presentOrganizer(organizer) }));
};

export const deleteOrganizerController: RequestHandler = async (request, response) => {
  const { organizerId } = response.locals.validatedParams as OrganizerIdParams;
  await deleteOrganizer(request.auth!.userId, organizerId);
  response.json(successResponse('Organizer deleted', { deleted: true }));
};

export const listOrganizerEventsController: RequestHandler = async (_request, response) => {
  const { organizerId } = response.locals.validatedParams as OrganizerIdParams;
  const filters = response.locals.validatedQuery as ListOrganizerEventsQuery;
  const result = await listPublicEvents({
    ...filters,
    organizerId,
    startsFrom: filters.startsFrom === undefined ? undefined : new Date(filters.startsFrom),
  });
  response.json(successResponse('Organizer events retrieved', {
    events: result.rows.map(presentEvent),
    pagination: {
      page: filters.page,
      limit: filters.limit,
      total: result.total,
      totalPages: result.total === 0 ? 0 : Math.ceil(result.total / filters.limit),
    },
  }));
};
