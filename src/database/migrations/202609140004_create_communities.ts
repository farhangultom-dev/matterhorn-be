import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('communities', (table) => {
    table.uuid('id').primary();
    table.string('name', 150).notNullable();
    table.string('slug', 160).notNullable().unique('communities_slug_unique');
    table.text('description').nullable();
    table.text('logo_url').nullable();
    table.text('cover_url').nullable();
    table.integer('city_id').nullable().references('id').inTable('cities').onDelete('SET NULL');
    table.uuid('owner_user_id').nullable().references('id').inTable('users').onDelete('SET NULL');
    table.string('visibility', 20).notNullable().defaultTo('public');
    table.string('status', 20).notNullable().defaultTo('draft');
    table.string('contact_person', 150).nullable();
    table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp('deleted_at', { useTz: true }).nullable();
    table.index(['city_id'], 'communities_city_id_index');
    table.index(['owner_user_id'], 'communities_owner_user_id_index');
    table.check("visibility in ('public', 'private')", [], 'communities_visibility_check');
    table.check("status in ('draft', 'active', 'inactive', 'suspended')", [], 'communities_status_check');
  });

  await knex.schema.createTable('community_discipline_sports', (table) => {
    table.increments('id').primary();
    table.uuid('community_id').notNullable().references('id').inTable('communities').onDelete('CASCADE');
    table.integer('discipline_sport_id').notNullable().references('id').inTable('discipline_sports').onDelete('RESTRICT');
    table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp('deleted_at', { useTz: true }).nullable();
    table.unique(['community_id', 'discipline_sport_id'], { indexName: 'community_discipline_sports_community_id_sport_id_unique' });
    table.index(['discipline_sport_id'], 'community_discipline_sports_sport_id_index');
  });

  await knex.schema.createTable('community_social_links', (table) => {
    table.increments('id').primary();
    table.uuid('community_id').notNullable().references('id').inTable('communities').onDelete('CASCADE');
    table.string('platform', 50).notNullable();
    table.text('url').notNullable();
    table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp('deleted_at', { useTz: true }).nullable();
    table.unique(['community_id', 'platform'], { indexName: 'community_social_links_community_id_platform_unique' });
  });

  await knex.schema.createTable('community_locations', (table) => {
    table.increments('id').primary();
    table.uuid('community_id').notNullable().references('id').inTable('communities').onDelete('CASCADE');
    table.integer('city_id').nullable().references('id').inTable('cities').onDelete('SET NULL');
    table.text('url_gmaps_locations').nullable();
    table.boolean('is_primary').notNullable().defaultTo(false);
    table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp('deleted_at', { useTz: true }).nullable();
    table.index(['community_id'], 'community_locations_community_id_index');
    table.index(['city_id'], 'community_locations_city_id_index');
  });
  await knex.raw('create unique index community_locations_one_active_primary_unique on community_locations (community_id) where is_primary = true and deleted_at is null');

  await knex.schema.createTable('community_schedules', (table) => {
    table.increments('id').primary();
    table.uuid('community_id').notNullable().references('id').inTable('communities').onDelete('CASCADE');
    table.specificType('day_of_week', 'smallint').notNullable();
    table.time('start_time').notNullable();
    table.time('end_time').notNullable();
    table.integer('location_id').nullable().references('id').inTable('community_locations').onDelete('SET NULL');
    table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp('deleted_at', { useTz: true }).nullable();
    table.unique(['community_id', 'day_of_week', 'start_time', 'location_id'], { indexName: 'community_schedules_unique_slot' });
    table.index(['location_id'], 'community_schedules_location_id_index');
    table.check('day_of_week between 1 and 7', [], 'community_schedules_day_of_week_check');
    table.check('end_time > start_time', [], 'community_schedules_time_range_check');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTable('community_schedules');
  await knex.schema.dropTable('community_locations');
  await knex.schema.dropTable('community_social_links');
  await knex.schema.dropTable('community_discipline_sports');
  await knex.schema.dropTable('communities');
}
