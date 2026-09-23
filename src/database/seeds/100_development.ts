import type { Knex } from 'knex';
import { getBcryptSaltRounds, getSeedEnv } from '../../config/env';
import { hashPassword } from '../../utils/password';
import { developmentIds, developmentValues } from './seed-data';

interface NamedIdRow {
  readonly id: number;
  readonly name: string;
}

interface StringIdRow {
  readonly id: string;
}

interface NamedCityIdRow {
  readonly id: number;
  readonly province_id: number;
  readonly name: string;
}

interface CommunityLocationRow {
  readonly id: number;
  readonly community_id: string;
  readonly city_id: number | null;
  readonly url_gmaps_locations: string | null;
  readonly is_primary: boolean;
}

const getReferenceId = async (transaction: Knex.Transaction, tableName: string, name: string): Promise<number> => {
  const row = await transaction<NamedIdRow>(tableName).select('id').where({ name }).whereNull('deleted_at').first();
  if (!row) throw new Error(`Missing reference row ${tableName}.${name}. Run db:seed:reference first.`);
  return row.id;
};

const getCityId = async (transaction: Knex.Transaction, provinceId: number, cityName: string): Promise<number> => {
  const row = await transaction<NamedCityIdRow>('cities').select('id').where({ province_id: provinceId, name: cityName }).whereNull('deleted_at').first();
  if (!row) throw new Error(`Missing seeded city ${cityName}. Run db:seed:reference first.`);
  return row.id;
};

const assertUniqueOwner = async (
  transaction: Knex.Transaction,
  tableName: string,
  columnName: string,
  value: string,
  expectedId: string,
): Promise<void> => {
  const row = await transaction<StringIdRow>(tableName).select('id').where(columnName, value).first();
  if (row && row.id !== expectedId) {
    throw new Error(`Cannot seed ${tableName}: ${columnName} is already owned by a different row.`);
  }
};

const getOrCreateLocationId = async (transaction: Knex.Transaction, cityId: number): Promise<number> => {
  const existing = await transaction<CommunityLocationRow>('community_locations')
    .select('id')
    .where({ community_id: developmentIds.community, url_gmaps_locations: developmentValues.communityLocationUrl })
    .first();
  if (existing) {
    await transaction('community_locations').where({ id: existing.id }).update({ city_id: cityId, is_primary: true });
    return existing.id;
  }

  const rows = await transaction<CommunityLocationRow>('community_locations')
    .insert({
      community_id: developmentIds.community,
      city_id: cityId,
      url_gmaps_locations: developmentValues.communityLocationUrl,
      is_primary: true,
    })
    .returning('id');
  return rows[0].id;
};

export async function seed(knex: Knex): Promise<void> {
  const seedEnv = getSeedEnv();
  if (seedEnv.nodeEnv === 'production') throw new Error('Development seed cannot run when NODE_ENV=production.');

  const passwordHash = await hashPassword(seedEnv.demoPassword, getBcryptSaltRounds());

  await knex.transaction(async (transaction) => {
    const adminRoleId = await getReferenceId(transaction, 'roles', 'admin');
    const commonUserRoleId = await getReferenceId(transaction, 'roles', 'common_user');
    const legacyMemberRoleId = await getReferenceId(transaction, 'roles', 'member');
    const dkiJakartaId = await getReferenceId(transaction, 'provinces', 'DKI JAKARTA');
    const jakartaSelatanId = await getCityId(transaction, dkiJakartaId, 'JAKARTA SELATAN');
    const mmaSportId = await getReferenceId(transaction, 'discipline_sports', 'MMA');
    const bjjSportId = await getReferenceId(transaction, 'discipline_sports', 'BJJ');

    await assertUniqueOwner(transaction, 'users', 'email', developmentValues.adminEmail, developmentIds.adminUser);
    await assertUniqueOwner(transaction, 'users', 'email', developmentValues.commonUserEmail, developmentIds.commonUser);
    await transaction('users')
      .insert([
        { id: developmentIds.adminUser, name: 'Demo Admin', email: developmentValues.adminEmail, password_hash: passwordHash, is_email_verified: true, updated_at: transaction.fn.now() },
        { id: developmentIds.commonUser, name: 'Demo Common User', email: developmentValues.commonUserEmail, password_hash: passwordHash, is_email_verified: true, updated_at: transaction.fn.now() },
      ])
      .onConflict('id')
      .merge(['name', 'email', 'password_hash', 'is_email_verified', 'updated_at']);

    await transaction('user_details')
      .insert([
        { user_id: developmentIds.adminUser, name: 'Demo Admin', city_id: jakartaSelatanId, phone_number: '0000000001', gender: 'prefer_not_to_say', height: 170, weight: 65 },
        { user_id: developmentIds.commonUser, name: 'Demo Common User', city_id: jakartaSelatanId, phone_number: '0000000002', gender: 'prefer_not_to_say', height: 165, weight: 60 },
      ])
      .onConflict('user_id')
      .merge(['name', 'city_id', 'phone_number', 'gender', 'height', 'weight']);
    await transaction('user_roles')
      .insert([
        { user_id: developmentIds.adminUser, role_id: adminRoleId },
        { user_id: developmentIds.commonUser, role_id: commonUserRoleId },
      ])
      .onConflict(['user_id', 'role_id'])
      .ignore();
    await transaction('user_roles')
      .where({ user_id: developmentIds.commonUser, role_id: legacyMemberRoleId })
      .delete();
    await transaction('user_discipline_sports')
      .insert([
        { user_id: developmentIds.adminUser, discipline_sport_id: mmaSportId },
        { user_id: developmentIds.commonUser, discipline_sport_id: mmaSportId },
        { user_id: developmentIds.commonUser, discipline_sport_id: bjjSportId },
      ])
      .onConflict(['user_id', 'discipline_sport_id'])
      .ignore();
    await transaction('user_discipline_sports')
      .whereIn('user_id', [developmentIds.adminUser, developmentIds.commonUser])
      .whereNotIn('discipline_sport_id', [mmaSportId, bjjSportId])
      .delete();

    await assertUniqueOwner(transaction, 'communities', 'slug', developmentValues.communitySlug, developmentIds.community);
    await transaction('communities')
      .insert({
        id: developmentIds.community,
        name: developmentValues.communityName,
        slug: developmentValues.communitySlug,
        description: 'A local development community for martial arts enthusiasts.',
        city_id: jakartaSelatanId,
        owner_user_id: developmentIds.adminUser,
        visibility: 'public',
        status: 'active',
        contact_person: 'Demo Admin',
        updated_at: transaction.fn.now(),
      })
      .onConflict('id')
      .merge(['name', 'slug', 'description', 'city_id', 'owner_user_id', 'visibility', 'status', 'contact_person', 'updated_at']);
    await transaction('community_discipline_sports')
      .insert({ community_id: developmentIds.community, discipline_sport_id: mmaSportId })
      .onConflict(['community_id', 'discipline_sport_id'])
      .ignore();
    await transaction('community_discipline_sports')
      .where({ community_id: developmentIds.community })
      .whereNot('discipline_sport_id', mmaSportId)
      .delete();
    await transaction('community_social_links')
      .insert({ community_id: developmentIds.community, platform: 'website', url: 'https://example.test/matterhorn-fight-club' })
      .onConflict(['community_id', 'platform'])
      .merge(['url']);

    const locationId = await getOrCreateLocationId(transaction, jakartaSelatanId);
    await transaction('community_schedules')
      .insert({ community_id: developmentIds.community, day_of_week: 1, start_time: '06:00:00', end_time: '08:00:00', location_id: locationId })
      .onConflict(['community_id', 'day_of_week', 'start_time', 'location_id'])
      .ignore();

    await transaction('organizers')
      .insert({
        id: developmentIds.organizer,
        name: developmentValues.organizerName,
        community_id: developmentIds.community,
        email: 'organizer@matterhorn.test',
        phone: '0000000003',
        updated_at: transaction.fn.now(),
      })
      .onConflict('id')
      .merge(['name', 'community_id', 'email', 'phone', 'updated_at']);

    await assertUniqueOwner(transaction, 'events', 'slug', developmentValues.eventSlug, developmentIds.event);
    await transaction('events')
      .insert({
        id: developmentIds.event,
        organizer_id: developmentIds.organizer,
        title: developmentValues.eventTitle,
        slug: developmentValues.eventSlug,
        description: 'A deterministic development event.',
        event_type: 'meetup',
        visibility: 'public',
        starts_at: '2027-03-14T00:00:00.000Z',
        ends_at: '2027-03-14T03:00:00.000Z',
        venue_name: 'Matterhorn Park',
        venue_address: 'Jakarta Selatan',
        venue_gmaps_url: developmentValues.communityLocationUrl,
        city_id: jakartaSelatanId,
        capacity: 100,
        registration_open_at: '2027-01-01T00:00:00.000Z',
        registration_close_at: '2027-03-13T00:00:00.000Z',
        updated_at: transaction.fn.now(),
      })
      .onConflict('id')
      .merge(['organizer_id', 'title', 'slug', 'description', 'event_type', 'visibility', 'starts_at', 'ends_at', 'venue_name', 'venue_address', 'venue_gmaps_url', 'city_id', 'capacity', 'registration_open_at', 'registration_close_at', 'updated_at']);
    await transaction('event_discipline_sports')
      .insert({ id: developmentIds.eventSport, event_id: developmentIds.event, discipline_sport_id: mmaSportId, updated_at: transaction.fn.now() })
      .onConflict('id')
      .merge(['event_id', 'discipline_sport_id', 'updated_at']);
    await transaction('event_participants')
      .insert({ id: developmentIds.participant, event_id: developmentIds.event, user_id: developmentIds.commonUser, status: 'registered' })
      .onConflict('id')
      .merge(['event_id', 'user_id', 'status']);
    await transaction('event_ticket_types')
      .insert([
        { id: developmentIds.freeTicket, event_id: developmentIds.event, name: 'Free', price: 0, quota: 50, sales_start_at: '2027-01-01T00:00:00.000Z', sales_end_at: '2027-03-13T00:00:00.000Z' },
        { id: developmentIds.regularTicket, event_id: developmentIds.event, name: 'Regular', price: 100000, quota: 50, sales_start_at: '2027-01-01T00:00:00.000Z', sales_end_at: '2027-03-13T00:00:00.000Z' },
      ])
      .onConflict('id')
      .merge(['event_id', 'name', 'price', 'quota', 'sales_start_at', 'sales_end_at']);

    await transaction('orders')
      .insert({ id: developmentIds.order, user_id: developmentIds.commonUser, subtotal_amount: 200000, fee_amount: 5000, total_amount: 205000, status: 'pending', updated_at: transaction.fn.now() })
      .onConflict('id')
      .merge(['user_id', 'subtotal_amount', 'fee_amount', 'total_amount', 'status', 'updated_at']);
    await transaction('order_items')
      .insert({ id: developmentIds.orderItem, order_id: developmentIds.order, event_ticket_type_id: developmentIds.regularTicket, quantity: 2, unit_price: 100000, subtotal: 200000 })
      .onConflict('id')
      .merge(['order_id', 'event_ticket_type_id', 'quantity', 'unit_price', 'subtotal']);
    await transaction('payment_transactions')
      .insert({ order_id: developmentIds.order, provider: 'demo', provider_reference: 'demo-provider-transaction-0001', merchant_reference: developmentValues.merchantReference, amount: 205000, status: 'pending', expires_at: '2027-03-13T00:00:00.000Z' })
      .onConflict('merchant_reference')
      .merge(['order_id', 'provider', 'provider_reference', 'amount', 'status', 'expires_at']);
  });

  console.log('Development seed: demo users, community, event, order, and payment are ready');
}
