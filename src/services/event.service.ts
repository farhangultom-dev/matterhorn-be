import { randomUUID } from 'node:crypto';
import { getDatabase } from '../config/database';
import { hasAnyActiveRoleId } from '../models/user-role.model';
import { findActiveCityInTransaction, findActiveOrganizerInTransaction, findEventDisciplineSports, findEventForUpdate, findEventTicketTypes, findPublicEventById, findPublicEvents, insertEvent, insertEventDisciplineSports, insertEventTicketTypes, isEventCityForeignKeyError, isEventDisciplineSportForeignKeyError, isEventOrganizerForeignKeyError, isUniqueEventSlugError, softDeleteEvent, updateEvent as updateEventRecord, type EventCreateValues, type EventDisciplineSportCreateValues, type EventDisciplineSportRecord, type EventListFilters, type EventRecord, type EventTicketTypeCreateValues, type EventTicketTypeRecord, type EventUpdateValues } from '../models/event.model';
import type { CreateEventInput, UpdateEventInput } from '../validations/event.validation';
import { AppError } from '../utils/app-error';
import { deleteUploadedEventPoster, uploadEventPoster, type EventPosterFile, type UploadedEventPoster } from './event-poster-storage.service';
import { StorageUnavailableError } from './profile-photo-storage.service';

const EVENT_MUTATION_ROLE_IDS = [1, 4] as const;

class InvalidEventOrganizerError extends Error {
  public constructor() {
    super('Organizer is not active');
    this.name = 'InvalidEventOrganizerError';
  }
}

class InvalidEventCityError extends Error {
  public constructor() {
    super('City is not active or does not belong to an active province');
    this.name = 'InvalidEventCityError';
  }
}

class InvalidEventDisciplineSportError extends Error {
  public constructor() {
    super('One or more discipline sports are not active');
    this.name = 'InvalidEventDisciplineSportError';
  }
}

const assertEventMutationAccess = async (actorUserId: string): Promise<void> => {
  if (!(await hasAnyActiveRoleId(actorUserId, EVENT_MUTATION_ROLE_IDS))) {
    throw new AppError(403, 'FORBIDDEN', 'Role ID 1 or 4 is required');
  }
};

const hasField = <T extends object>(input: T, field: keyof T): boolean => Object.prototype.hasOwnProperty.call(input, field);

const toDate = (value: string): Date => new Date(value);

const assertTimeRanges = ({ startsAt, endsAt, registrationOpenAt, registrationCloseAt }: { startsAt: Date; endsAt: Date; registrationOpenAt: Date | null; registrationCloseAt: Date | null }): void => {
  if (endsAt.getTime() <= startsAt.getTime()) {
    throw new AppError(400, 'VALIDATION_ERROR', 'endsAt must be later than startsAt');
  }
  if (registrationOpenAt !== null && registrationCloseAt !== null && registrationCloseAt.getTime() <= registrationOpenAt.getTime()) {
    throw new AppError(400, 'VALIDATION_ERROR', 'registrationCloseAt must be later than registrationOpenAt');
  }
};

const toCreateValues = (input: CreateEventInput): EventCreateValues => ({
  id: randomUUID(),
  organizer_id: input.organizerId,
  title: input.title,
  slug: input.slug,
  description: input.description ?? null,
  event_type: input.eventType,
  visibility: input.visibility,
  starts_at: toDate(input.startsAt),
  ends_at: toDate(input.endsAt),
  venue_name: input.venueName ?? null,
  venue_address: input.venueAddress ?? null,
  venue_gmaps_url: input.venueGmapsUrl ?? null,
  city_id: input.cityId ?? null,
  capacity: input.capacity ?? null,
  registration_open_at: input.registrationOpenAt === undefined || input.registrationOpenAt === null ? null : toDate(input.registrationOpenAt),
  registration_close_at: input.registrationCloseAt === undefined || input.registrationCloseAt === null ? null : toDate(input.registrationCloseAt),
  poster_url: null,
});

const toUpdateValues = (input: UpdateEventInput): EventUpdateValues => ({
  ...(input.organizerId !== undefined ? { organizer_id: input.organizerId } : {}),
  ...(input.title !== undefined ? { title: input.title } : {}),
  ...(input.slug !== undefined ? { slug: input.slug } : {}),
  ...(hasField(input, 'description') ? { description: input.description ?? null } : {}),
  ...(input.eventType !== undefined ? { event_type: input.eventType } : {}),
  ...(input.visibility !== undefined ? { visibility: input.visibility } : {}),
  ...(input.startsAt !== undefined ? { starts_at: toDate(input.startsAt) } : {}),
  ...(input.endsAt !== undefined ? { ends_at: toDate(input.endsAt) } : {}),
  ...(hasField(input, 'venueName') ? { venue_name: input.venueName ?? null } : {}),
  ...(hasField(input, 'venueAddress') ? { venue_address: input.venueAddress ?? null } : {}),
  ...(hasField(input, 'venueGmapsUrl') ? { venue_gmaps_url: input.venueGmapsUrl ?? null } : {}),
  ...(hasField(input, 'cityId') ? { city_id: input.cityId ?? null } : {}),
  ...(hasField(input, 'capacity') ? { capacity: input.capacity ?? null } : {}),
  ...(hasField(input, 'registrationOpenAt') ? { registration_open_at: input.registrationOpenAt === null || input.registrationOpenAt === undefined ? null : toDate(input.registrationOpenAt) } : {}),
  ...(hasField(input, 'registrationCloseAt') ? { registration_close_at: input.registrationCloseAt === null || input.registrationCloseAt === undefined ? null : toDate(input.registrationCloseAt) } : {}),
  ...(hasField(input, 'posterUrl') ? { poster_url: input.posterUrl ?? null } : {}),
});

const toDisciplineSportValues = (eventId: string, disciplineSportIds: readonly number[]): EventDisciplineSportCreateValues[] => disciplineSportIds.map((disciplineSportId) => ({
  id: randomUUID(),
  event_id: eventId,
  discipline_sport_id: disciplineSportId,
}));

const toTicketTypeValues = (eventId: string, ticketTypes: CreateEventInput['ticketTypes']): EventTicketTypeCreateValues[] => ticketTypes.map((ticketType) => ({
  id: randomUUID(),
  event_id: eventId,
  name: ticketType.name,
  price: ticketType.price,
  quota: ticketType.quota,
  sales_start_at: toDate(ticketType.salesStartAt),
  sales_end_at: toDate(ticketType.salesEndAt),
}));

const mapEventReferenceError = (error: unknown): never => {
  if (error instanceof InvalidEventOrganizerError || isEventOrganizerForeignKeyError(error)) {
    throw new AppError(400, 'INVALID_ORGANIZER', 'Organizer is not active');
  }
  if (error instanceof InvalidEventCityError || isEventCityForeignKeyError(error)) {
    throw new AppError(400, 'INVALID_CITY', 'City is not active or does not belong to an active province');
  }
  throw error;
};

export interface EventWithRelations extends EventRecord {
  readonly disciplineSports: EventDisciplineSportRecord[];
}

export interface EventDetailWithRelations extends EventWithRelations {
  readonly ticketTypes: EventTicketTypeRecord[];
}

const attachEventRelations = async (events: readonly EventRecord[]): Promise<EventWithRelations[]> => {
  const relationsByEvent = await findEventDisciplineSports(events.map((event) => event.id));
  return events.map((event) => ({ ...event, disciplineSports: relationsByEvent.get(event.id) ?? [] }));
};

export const listPublicEvents = async (filters: EventListFilters): Promise<{ rows: EventWithRelations[]; total: number }> => {
  const result = await findPublicEvents(filters);
  return { rows: await attachEventRelations(result.rows), total: result.total };
};

export const getPublicEvent = async (eventId: string): Promise<EventDetailWithRelations> => {
  const event = await findPublicEventById(eventId);
  if (!event) throw new AppError(404, 'EVENT_NOT_FOUND', 'Event not found');
  const [eventWithRelations] = await attachEventRelations([event]);
  return { ...eventWithRelations!, ticketTypes: await findEventTicketTypes(eventId) };
};

export const createEvent = async (actorUserId: string, input: CreateEventInput, file?: EventPosterFile): Promise<EventRecord> => {
  await assertEventMutationAccess(actorUserId);
  const values = toCreateValues(input);
  const disciplineSportValues = toDisciplineSportValues(values.id, input.disciplineSports ?? []);
  const ticketTypeValues = toTicketTypeValues(values.id, input.ticketTypes ?? []);
  assertTimeRanges({
    startsAt: values.starts_at,
    endsAt: values.ends_at,
    registrationOpenAt: values.registration_open_at,
    registrationCloseAt: values.registration_close_at,
  });
  let uploaded: UploadedEventPoster | undefined;
  let committed = false;
  try {
    if (file) uploaded = await uploadEventPoster({ eventId: values.id, file });
    const created = await getDatabase().transaction(async (transaction) => {
      if (!(await findActiveOrganizerInTransaction(transaction, values.organizer_id))) throw new InvalidEventOrganizerError();
      if (values.city_id !== null && !(await findActiveCityInTransaction(transaction, values.city_id))) throw new InvalidEventCityError();
      if (disciplineSportValues.length > 0) {
        const activeDisciplineSports = await transaction('discipline_sports')
          .select('id')
          .whereIn('id', disciplineSportValues.map((value) => value.discipline_sport_id))
          .whereNull('deleted_at');
        if (activeDisciplineSports.length !== disciplineSportValues.length) throw new InvalidEventDisciplineSportError();
      }
      const event = await insertEvent(transaction, { ...values, poster_url: uploaded?.url ?? null });
      await insertEventDisciplineSports(transaction, disciplineSportValues);
      await insertEventTicketTypes(transaction, ticketTypeValues);
      return event;
    });
    committed = true;
    return created;
  } catch (error) {
    if (uploaded && !committed) {
      try {
        await deleteUploadedEventPoster(uploaded.key);
      } catch {
        // Rollback cleanup is best effort and must not hide the original error.
      }
    }
    if (error instanceof StorageUnavailableError) throw new AppError(503, 'STORAGE_UNAVAILABLE', 'Event poster storage is unavailable');
    if (error instanceof InvalidEventDisciplineSportError || isEventDisciplineSportForeignKeyError(error)) throw new AppError(400, 'INVALID_DISCIPLINE_SPORT', 'One or more discipline sports are not active');
    if (isUniqueEventSlugError(error)) throw new AppError(409, 'EVENT_SLUG_EXISTS', 'Event slug is already in use');
    return mapEventReferenceError(error);
  }
};

export const updateEvent = async (actorUserId: string, eventId: string, input: UpdateEventInput): Promise<EventRecord> => {
  await assertEventMutationAccess(actorUserId);
  const values = toUpdateValues(input);
  try {
    return await getDatabase().transaction(async (transaction) => {
      const current = await findEventForUpdate(transaction, eventId);
      if (!current) throw new AppError(404, 'EVENT_NOT_FOUND', 'Event not found');
      const startsAt = values.starts_at ?? current.starts_at;
      const endsAt = values.ends_at ?? current.ends_at;
      const registrationOpenAt = values.registration_open_at !== undefined ? values.registration_open_at : current.registration_open_at;
      const registrationCloseAt = values.registration_close_at !== undefined ? values.registration_close_at : current.registration_close_at;
      assertTimeRanges({ startsAt, endsAt, registrationOpenAt, registrationCloseAt });
      if (values.organizer_id !== undefined && !(await findActiveOrganizerInTransaction(transaction, values.organizer_id))) throw new InvalidEventOrganizerError();
      if (values.city_id !== undefined && values.city_id !== null && !(await findActiveCityInTransaction(transaction, values.city_id))) throw new InvalidEventCityError();
      return updateEventRecord(transaction, eventId, values);
    });
  } catch (error) {
    if (error instanceof AppError) throw error;
    if (isUniqueEventSlugError(error)) throw new AppError(409, 'EVENT_SLUG_EXISTS', 'Event slug is already in use');
    return mapEventReferenceError(error);
  }
};

export const deleteEvent = async (actorUserId: string, eventId: string): Promise<void> => {
  await assertEventMutationAccess(actorUserId);
  await getDatabase().transaction(async (transaction) => {
    const current = await findEventForUpdate(transaction, eventId);
    if (!current) throw new AppError(404, 'EVENT_NOT_FOUND', 'Event not found');
    await softDeleteEvent(transaction, eventId);
  });
};
