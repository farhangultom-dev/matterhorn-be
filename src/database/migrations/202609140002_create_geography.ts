import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('provinces', (table) => {
    table.increments('id').primary();
    table.string('name', 100).notNullable().unique('provinces_name_unique');
    table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp('deleted_at', { useTz: true }).nullable();
  });

  await knex.schema.createTable('cities', (table) => {
    table.increments('id').primary();
    table.integer('province_id').notNullable().references('id').inTable('provinces').onDelete('RESTRICT');
    table.string('name', 100).notNullable();
    table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp('deleted_at', { useTz: true }).nullable();
    table.unique(['province_id', 'name'], { indexName: 'cities_province_id_name_unique' });
    table.index(['province_id'], 'cities_province_id_index');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTable('cities');
  await knex.schema.dropTable('provinces');
}
