import type { EventRecord } from '../models/event.model';
import type { EventDetailWithRelations, EventWithRelations } from '../services/event.service';

export interface PublicEventDisciplineSport {
  readonly id: string;
  readonly disciplineSportId: number;
  readonly name: string;
  readonly createdAt: string;
}

export interface PublicEventTicketType {
  readonly id: string;
  readonly name: string;
  readonly price: number;
  readonly quota: number;
  readonly salesStartAt: string;
  readonly salesEndAt: string;
}

export interface PublicEvent {
  readonly id: string;
  readonly organizerId: string;
  readonly title: string;
  readonly slug: string;
  readonly description: string | null;
  readonly eventType: EventRecord['event_type'];
  readonly visibility: EventRecord['visibility'];
  readonly startsAt: string;
  readonly endsAt: string;
  readonly venueName: string | null;
  readonly venueAddress: string | null;
  readonly venueGmapsUrl: string | null;
  readonly cityId: number | null;
  readonly capacity: number | null;
  readonly registrationOpenAt: string | null;
  readonly registrationCloseAt: string | null;
  readonly posterUrl: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly disciplineSports: readonly PublicEventDisciplineSport[];
  readonly ticketTypes?: readonly PublicEventTicketType[];
}

const toIso = (value: Date | string): string => new Date(value).toISOString();

export const presentEvent = (event: EventRecord | EventWithRelations | EventDetailWithRelations): PublicEvent => ({
  id: event.id,
  organizerId: event.organizer_id,
  title: event.title,
  slug: event.slug,
  description: event.description,
  eventType: event.event_type,
  visibility: event.visibility,
  startsAt: toIso(event.starts_at),
  endsAt: toIso(event.ends_at),
  venueName: event.venue_name,
  venueAddress: event.venue_address,
  venueGmapsUrl: event.venue_gmaps_url,
  cityId: event.city_id,
  capacity: event.capacity,
  registrationOpenAt: event.registration_open_at === null ? null : toIso(event.registration_open_at),
  registrationCloseAt: event.registration_close_at === null ? null : toIso(event.registration_close_at),
  posterUrl: event.poster_url,
  createdAt: toIso(event.created_at),
  updatedAt: toIso(event.updated_at),
  disciplineSports: 'disciplineSports' in event
    ? event.disciplineSports.map((disciplineSport) => ({
      id: disciplineSport.id,
      disciplineSportId: disciplineSport.discipline_sport_id,
      name: disciplineSport.discipline_sport_name,
      createdAt: toIso(disciplineSport.created_at),
    }))
    : [],
  ...( 'ticketTypes' in event ? {
    ticketTypes: event.ticketTypes.map((ticketType) => ({
      id: ticketType.id,
      name: ticketType.name,
      price: ticketType.price,
      quota: ticketType.quota,
      salesStartAt: toIso(ticketType.sales_start_at),
      salesEndAt: toIso(ticketType.sales_end_at),
    })),
  } : {}),
});
