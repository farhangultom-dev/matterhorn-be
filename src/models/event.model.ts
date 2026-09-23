import type { Knex } from 'knex';
import { getDatabase } from '../config/database';
import { findActiveCityInTransaction } from './community.model';

export type EventType = 'training' | 'competition' | 'meetup' | 'other';
export type EventVisibility = 'public' | 'private';

export interface EventRecord {
  readonly id: string;
  readonly organizer_id: string;
  readonly title: string;
  readonly slug: string;
  readonly description: string | null;
  readonly event_type: EventType;
  readonly visibility: EventVisibility;
  readonly starts_at: Date;
  readonly ends_at: Date;
  readonly venue_name: string | null;
  readonly venue_address: string | null;
  readonly venue_gmaps_url: string | null;
  readonly city_id: number | null;
  readonly capacity: number | null;
  readonly registration_open_at: Date | null;
  readonly registration_close_at: Date | null;
  readonly poster_url: string | null;
  readonly created_at: Date;
  readonly updated_at: Date;
}

export interface EventCreateValues {
  readonly id: string;
  readonly organizer_id: string;
  readonly title: string;
  readonly slug: string;
  readonly description: string | null;
  readonly event_type: EventType;
  readonly visibility: EventVisibility;
  readonly starts_at: Date;
  readonly ends_at: Date;
  readonly venue_name: string | null;
  readonly venue_address: string | null;
  readonly venue_gmaps_url: string | null;
  readonly city_id: number | null;
  readonly capacity: number | null;
  readonly registration_open_at: Date | null;
  readonly registration_close_at: Date | null;
  readonly poster_url: string | null;
}

export interface EventUpdateValues {
  readonly organizer_id?: string;
  readonly title?: string;
  readonly slug?: string;
  readonly description?: string | null;
  readonly event_type?: EventType;
  readonly visibility?: EventVisibility;
  readonly starts_at?: Date;
  readonly ends_at?: Date;
  readonly venue_name?: string | null;
  readonly venue_address?: string | null;
  readonly venue_gmaps_url?: string | null;
  readonly city_id?: number | null;
  readonly capacity?: number | null;
  readonly registration_open_at?: Date | null;
  readonly registration_close_at?: Date | null;
  readonly poster_url?: string | null;
}

export interface EventListFilters {
  readonly page: number;
  readonly limit: number;
  readonly search?: string;
  readonly cityId?: number;
  readonly disciplineSportId?: number;
  readonly organizerId?: string;
  readonly eventType?: EventType;
  readonly startsFrom?: Date;
}

export interface EventListResult {
  readonly rows: EventRecord[];
  readonly total: number;
}

export interface EventDisciplineSportRecord {
  readonly id: string;
  readonly event_id: string;
  readonly discipline_sport_id: number;
  readonly discipline_sport_name: string;
  readonly created_at: Date;
}

export interface EventTicketTypeRecord {
  readonly id: string;
  readonly event_id: string;
  readonly name: string;
  readonly price: number;
  readonly quota: number;
  readonly sales_start_at: Date;
  readonly sales_end_at: Date;
}

export interface EventDisciplineSportCreateValues {
  readonly id: string;
  readonly event_id: string;
  readonly discipline_sport_id: number;
}

export interface EventTicketTypeCreateValues {
  readonly id: string;
  readonly event_id: string;
  readonly name: string;
  readonly price: number;
  readonly quota: number;
  readonly sales_start_at: Date;
  readonly sales_end_at: Date;
}

type EventQuery = Knex.QueryBuilder<EventRecord, EventRecord[]>;

const eventColumns = [
  'id', 'organizer_id', 'title', 'slug', 'description', 'event_type', 'visibility',
  'starts_at', 'ends_at', 'venue_name', 'venue_address', 'venue_gmaps_url', 'city_id',
  'capacity', 'registration_open_at', 'registration_close_at', 'poster_url',
  'created_at', 'updated_at',
] as const;

const selectEventColumns = (query: EventQuery): EventQuery => query.select(...eventColumns);
const escapeLikePattern = (value: string): string => value.replace(/[\\%_]/g, '\\$&');

const createPublicEventQuery = (): EventQuery =>
  getDatabase()<EventRecord>('events').where({ visibility: 'public' }).whereNull('deleted_at');

const applyListFilters = (query: EventQuery, filters: EventListFilters): EventQuery => {
  if (filters.search) {
    const pattern = `%${escapeLikePattern(filters.search)}%`;
    query.andWhere((builder) => {
      builder.whereRaw("events.title ILIKE ? ESCAPE '\\'", [pattern])
        .orWhereRaw("events.slug ILIKE ? ESCAPE '\\'", [pattern])
        .orWhereExists(
          getDatabase()('cities as c')
            .join('provinces as p', 'p.id', 'c.province_id')
            .select('c.id')
            .whereRaw('c.id = events.city_id')
            .whereNull('c.deleted_at')
            .whereNull('p.deleted_at')
            .whereRaw("c.name ILIKE ? ESCAPE '\\'", [pattern]),
        )
        .orWhereExists(
          getDatabase()('event_discipline_sports as eds')
            .join('discipline_sports as ds', 'ds.id', 'eds.discipline_sport_id')
            .select('eds.id')
            .whereRaw('eds.event_id = events.id')
            .whereNull('ds.deleted_at')
            .whereRaw("ds.name ILIKE ? ESCAPE '\\'", [pattern]),
        );
    });
  }
  if (filters.cityId !== undefined) query.where({ city_id: filters.cityId });
  if (filters.disciplineSportId !== undefined) {
    query.whereExists(
      getDatabase()('event_discipline_sports as eds')
        .select('eds.id')
        .whereRaw('eds.event_id = events.id')
        .where('eds.discipline_sport_id', filters.disciplineSportId)
        .whereExists(getDatabase()('discipline_sports as ds').select('ds.id').whereRaw('ds.id = eds.discipline_sport_id').whereNull('ds.deleted_at')),
    );
  }
  if (filters.organizerId !== undefined) query.where({ organizer_id: filters.organizerId });
  if (filters.eventType !== undefined) query.where({ event_type: filters.eventType });
  if (filters.startsFrom !== undefined) query.where('starts_at', '>=', filters.startsFrom);
  return query;
};

export const findPublicEvents = async (filters: EventListFilters): Promise<EventListResult> => {
  const baseQuery = applyListFilters(createPublicEventQuery(), filters);
  const countRow = await baseQuery.clone().count<{ count: string }>({ count: 'id' }).first();
  const rows = await selectEventColumns(baseQuery.clone())
    .orderBy([{ column: 'starts_at', order: 'desc' }, { column: 'id', order: 'desc' }])
    .limit(filters.limit)
    .offset((filters.page - 1) * filters.limit);
  return { rows, total: Number(countRow?.count ?? 0) };
};

export const findPublicEventById = async (eventId: string): Promise<EventRecord | undefined> =>
  selectEventColumns(createPublicEventQuery()).where({ id: eventId }).first();

export const findEventDisciplineSports = async (eventIds: readonly string[]): Promise<Map<string, EventDisciplineSportRecord[]>> => {
  const relationsByEvent = new Map<string, EventDisciplineSportRecord[]>();
  for (const eventId of eventIds) relationsByEvent.set(eventId, []);
  if (eventIds.length === 0) return relationsByEvent;

  const rows = await getDatabase()<EventDisciplineSportRecord>('event_discipline_sports as eds')
    .join('discipline_sports as ds', 'ds.id', 'eds.discipline_sport_id')
    .select('eds.id', 'eds.event_id', 'eds.discipline_sport_id', 'ds.name as discipline_sport_name', 'eds.created_at')
    .whereIn('eds.event_id', eventIds)
    .whereNull('ds.deleted_at')
    .orderBy([{ column: 'ds.name', order: 'asc' }, { column: 'eds.id', order: 'asc' }]);

  for (const row of rows) relationsByEvent.get(row.event_id)?.push(row);
  return relationsByEvent;
};

export const findEventTicketTypes = async (eventId: string): Promise<EventTicketTypeRecord[]> =>
  getDatabase()<EventTicketTypeRecord>('event_ticket_types')
    .select('id', 'event_id', 'name', 'price', 'quota', 'sales_start_at', 'sales_end_at')
    .where({ event_id: eventId })
    .orderBy([{ column: 'sales_start_at', order: 'asc' }, { column: 'id', order: 'asc' }]);

export const findEventForUpdate = async (transaction: Knex.Transaction, eventId: string): Promise<EventRecord | undefined> =>
  selectEventColumns(transaction<EventRecord>('events')).where({ id: eventId }).whereNull('deleted_at').forUpdate().first();

export const findActiveOrganizerInTransaction = async (transaction: Knex.Transaction, organizerId: string): Promise<boolean> => {
  const organizer = await transaction('organizers').select('id').where({ id: organizerId }).whereNull('deleted_at').first();
  return organizer !== undefined;
};

export { findActiveCityInTransaction };

export const insertEvent = async (transaction: Knex.Transaction, values: EventCreateValues): Promise<EventRecord> => {
  const rows = await transaction<EventRecord>('events').insert(values).returning([
    'id', 'organizer_id', 'title', 'slug', 'description', 'event_type', 'visibility',
    'starts_at', 'ends_at', 'venue_name', 'venue_address', 'venue_gmaps_url', 'city_id',
    'capacity', 'registration_open_at', 'registration_close_at', 'poster_url', 'created_at', 'updated_at',
  ]);
  const event = rows[0];
  if (!event) throw new Error('Event insert did not return a row.');
  return event;
};

export const insertEventDisciplineSports = async (transaction: Knex.Transaction, values: readonly EventDisciplineSportCreateValues[]): Promise<void> => {
  if (values.length === 0) return;
  await transaction('event_discipline_sports').insert(values);
};

export const insertEventTicketTypes = async (transaction: Knex.Transaction, values: readonly EventTicketTypeCreateValues[]): Promise<void> => {
  if (values.length === 0) return;
  await transaction('event_ticket_types').insert(values);
};

export const updateEvent = async (transaction: Knex.Transaction, eventId: string, values: EventUpdateValues): Promise<EventRecord> => {
  const rows = await transaction<EventRecord>('events').where({ id: eventId }).update({ ...values, updated_at: transaction.fn.now() }).returning([
    'id', 'organizer_id', 'title', 'slug', 'description', 'event_type', 'visibility',
    'starts_at', 'ends_at', 'venue_name', 'venue_address', 'venue_gmaps_url', 'city_id',
    'capacity', 'registration_open_at', 'registration_close_at', 'poster_url', 'created_at', 'updated_at',
  ]);
  const event = rows[0];
  if (!event) throw new Error('Event update did not return a row.');
  return event;
};

export const softDeleteEvent = async (transaction: Knex.Transaction, eventId: string): Promise<void> => {
  await transaction('events').where({ id: eventId }).update({ deleted_at: transaction.fn.now(), updated_at: transaction.fn.now() });
};

export const isUniqueEventSlugError = (error: unknown): boolean => {
  const candidate = error as { code?: string; constraint?: string };
  return candidate.code === '23505' && candidate.constraint === 'events_slug_unique';
};

export const isEventOrganizerForeignKeyError = (error: unknown): boolean => {
  const candidate = error as { code?: string; constraint?: string };
  return candidate.code === '23503' && (candidate.constraint === 'events_organizer_id_foreign' || candidate.constraint === 'events_organizer_id_fkey');
};

export const isEventCityForeignKeyError = (error: unknown): boolean => {
  const candidate = error as { code?: string; constraint?: string };
  return candidate.code === '23503' && (candidate.constraint === 'events_city_id_foreign' || candidate.constraint === 'events_city_id_fkey');
};

export const isEventDisciplineSportForeignKeyError = (error: unknown): boolean => {
  const candidate = error as { code?: string; constraint?: string };
  return candidate.code === '23503' && (candidate.constraint === 'event_discipline_sports_discipline_sport_id_foreign' || candidate.constraint === 'event_discipline_sports_discipline_sport_id_fkey');
};
