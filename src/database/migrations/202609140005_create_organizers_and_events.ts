import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('organizers', (table) => {
    table.uuid('id').primary();
    table.string('name', 150).notNullable();
    table.uuid('user_id').nullable().references('id').inTable('users').onDelete('SET NULL');
    table.uuid('community_id').nullable().references('id').inTable('communities').onDelete('SET NULL');
    table.text('logo_url').nullable();
    table.string('email', 254).nullable();
    table.string('phone', 30).nullable();
    table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp('deleted_at', { useTz: true }).nullable();
    table.index(['user_id'], 'organizers_user_id_index');
    table.index(['community_id'], 'organizers_community_id_index');
    table.check('user_id is not null or community_id is not null', [], 'organizers_owner_check');
  });

  await knex.schema.createTable('events', (table) => {
    table.uuid('id').primary();
    table.uuid('organizer_id').notNullable().references('id').inTable('organizers').onDelete('RESTRICT');
    table.string('title', 200).notNullable();
    table.string('slug', 220).notNullable().unique('events_slug_unique');
    table.text('description').nullable();
    table.string('event_type', 30).notNullable();
    table.string('visibility', 20).notNullable().defaultTo('public');
    table.timestamp('starts_at', { useTz: true }).notNullable();
    table.timestamp('ends_at', { useTz: true }).notNullable();
    table.string('venue_name', 200).nullable();
    table.text('venue_address').nullable();
    table.text('venue_gmaps_url').nullable();
    table.integer('city_id').nullable().references('id').inTable('cities').onDelete('SET NULL');
    table.integer('capacity').nullable();
    table.timestamp('registration_open_at', { useTz: true }).nullable();
    table.timestamp('registration_close_at', { useTz: true }).nullable();
    table.text('poster_url').nullable();
    table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp('deleted_at', { useTz: true }).nullable();
    table.index(['organizer_id'], 'events_organizer_id_index');
    table.index(['city_id'], 'events_city_id_index');
    table.index(['starts_at'], 'events_starts_at_index');
    table.check("event_type in ('training', 'competition', 'meetup', 'other')", [], 'events_event_type_check');
    table.check("visibility in ('public', 'private')", [], 'events_visibility_check');
    table.check('ends_at > starts_at', [], 'events_time_range_check');
    table.check('capacity is null or capacity > 0', [], 'events_capacity_check');
    table.check('registration_open_at is null or registration_close_at is null or registration_close_at > registration_open_at', [], 'events_registration_time_range_check');
  });

  await knex.schema.createTable('event_discipline_sports', (table) => {
    table.uuid('id').primary();
    table.uuid('event_id').notNullable().references('id').inTable('events').onDelete('CASCADE');
    table.integer('discipline_sport_id').notNullable().references('id').inTable('discipline_sports').onDelete('RESTRICT');
    table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.unique(['event_id', 'discipline_sport_id'], { indexName: 'event_discipline_sports_event_id_sport_id_unique' });
    table.index(['discipline_sport_id'], 'event_discipline_sports_sport_id_index');
  });

  await knex.schema.createTable('event_participants', (table) => {
    table.uuid('id').primary();
    table.uuid('event_id').notNullable().references('id').inTable('events').onDelete('RESTRICT');
    table.uuid('user_id').notNullable().references('id').inTable('users').onDelete('RESTRICT');
    table.string('status', 30).notNullable().defaultTo('registered');
    table.timestamp('registered_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.unique(['event_id', 'user_id'], { indexName: 'event_participants_event_id_user_id_unique' });
    table.index(['user_id'], 'event_participants_user_id_index');
    table.check("status in ('registered', 'confirmed', 'cancelled', 'attended')", [], 'event_participants_status_check');
  });

  await knex.schema.createTable('event_ticket_types', (table) => {
    table.uuid('id').primary();
    table.uuid('event_id').notNullable().references('id').inTable('events').onDelete('RESTRICT');
    table.string('name', 100).notNullable();
    table.integer('price').notNullable();
    table.integer('quota').notNullable();
    table.timestamp('sales_start_at', { useTz: true }).notNullable();
    table.timestamp('sales_end_at', { useTz: true }).notNullable();
    table.unique(['event_id', 'name'], { indexName: 'event_ticket_types_event_id_name_unique' });
    table.check('price >= 0', [], 'event_ticket_types_price_check');
    table.check('quota > 0', [], 'event_ticket_types_quota_check');
    table.check('sales_end_at > sales_start_at', [], 'event_ticket_types_sales_time_range_check');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTable('event_ticket_types');
  await knex.schema.dropTable('event_participants');
  await knex.schema.dropTable('event_discipline_sports');
  await knex.schema.dropTable('events');
  await knex.schema.dropTable('organizers');
}
