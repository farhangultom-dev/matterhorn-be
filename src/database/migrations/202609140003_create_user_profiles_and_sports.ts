import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('discipline_sports', (table) => {
    table.increments('id').primary();
    table.string('name', 100).notNullable().unique('discipline_sports_name_unique');
    table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp('deleted_at', { useTz: true }).nullable();
  });

  await knex.schema.createTable('user_details', (table) => {
    table.increments('id').primary();
    table.uuid('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE').unique('user_details_user_id_unique');
    table.string('name', 100).notNullable();
    table.text('address').nullable();
    table.integer('city_id').nullable().references('id').inTable('cities').onDelete('SET NULL');
    table.string('phone_number', 30).nullable();
    table.string('gender', 30).nullable();
    table.integer('height').nullable();
    table.integer('weight').nullable();
    table.text('profile_photo').nullable();
    table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp('deleted_at', { useTz: true }).nullable();
    table.index(['city_id'], 'user_details_city_id_index');
    table.check("gender is null or gender in ('male', 'female', 'other', 'prefer_not_to_say')", [], 'user_details_gender_check');
    table.check('height is null or height between 30 and 300', [], 'user_details_height_check');
    table.check('weight is null or weight between 1 and 500', [], 'user_details_weight_check');
  });

  await knex.schema.createTable('user_roles', (table) => {
    table.increments('id').primary();
    table.uuid('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
    table.integer('role_id').notNullable().references('id').inTable('roles').onDelete('RESTRICT');
    table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp('deleted_at', { useTz: true }).nullable();
    table.unique(['user_id', 'role_id'], { indexName: 'user_roles_user_id_role_id_unique' });
    table.index(['role_id'], 'user_roles_role_id_index');
  });

  await knex.schema.createTable('user_discipline_sports', (table) => {
    table.increments('id').primary();
    table.uuid('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
    table.integer('discipline_sport_id').notNullable().references('id').inTable('discipline_sports').onDelete('RESTRICT');
    table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp('deleted_at', { useTz: true }).nullable();
    table.unique(['user_id', 'discipline_sport_id'], { indexName: 'user_discipline_sports_user_id_sport_id_unique' });
    table.index(['discipline_sport_id'], 'user_discipline_sports_sport_id_index');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTable('user_discipline_sports');
  await knex.schema.dropTable('user_roles');
  await knex.schema.dropTable('user_details');
  await knex.schema.dropTable('discipline_sports');
}
