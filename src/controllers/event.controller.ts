import type { RequestHandler } from 'express';
import { createEvent, deleteEvent, getPublicEvent, listPublicEvents, updateEvent } from '../services/event.service';
import type { CreateEventInput, EventIdParams, ListEventsQuery, UpdateEventInput } from '../validations/event.validation';
import { successResponse } from '../views/response.view';
import { presentEvent } from '../views/event.view';
import type { EventPosterFile } from '../services/event-poster-storage.service';

export const listEventsController: RequestHandler = async (_request, response) => {
  const filters = response.locals.validatedQuery as ListEventsQuery;
  const result = await listPublicEvents({
    ...filters,
    startsFrom: filters.startsFrom === undefined ? undefined : new Date(filters.startsFrom),
  });
  response.json(successResponse('Events retrieved', {
    events: result.rows.map(presentEvent),
    pagination: {
      page: filters.page,
      limit: filters.limit,
      total: result.total,
      totalPages: result.total === 0 ? 0 : Math.ceil(result.total / filters.limit),
    },
  }));
};

export const getEventController: RequestHandler = async (_request, response) => {
  const { eventId } = response.locals.validatedParams as EventIdParams;
  const event = await getPublicEvent(eventId);
  response.json(successResponse('Event retrieved', { event: presentEvent(event) }));
};

export const createEventController: RequestHandler = async (request, response) => {
  const event = await createEvent(request.auth!.userId, response.locals.validatedBody as CreateEventInput, response.locals.eventPosterFile as EventPosterFile | undefined);
  response.status(201).json(successResponse('Event created', { event: presentEvent(event) }));
};

export const updateEventController: RequestHandler = async (request, response) => {
  const { eventId } = response.locals.validatedParams as EventIdParams;
  const event = await updateEvent(request.auth!.userId, eventId, response.locals.validatedBody as UpdateEventInput);
  response.json(successResponse('Event updated', { event: presentEvent(event) }));
};

export const deleteEventController: RequestHandler = async (request, response) => {
  const { eventId } = response.locals.validatedParams as EventIdParams;
  await deleteEvent(request.auth!.userId, eventId);
  response.json(successResponse('Event deleted', { deleted: true }));
};
