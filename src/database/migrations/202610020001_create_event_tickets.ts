import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('order_items', (table) => {
    table.string('event_title_snapshot', 200).nullable();
    table.string('ticket_type_name_snapshot', 100).nullable();
  });

  await knex.schema.createTable('event_tickets', (table) => {
    table.uuid('id').primary();
    table.uuid('order_item_id').notNullable().references('id').inTable('order_items').onDelete('RESTRICT');
    table.uuid('event_id').notNullable().references('id').inTable('events').onDelete('RESTRICT');
    table.integer('ticket_number').notNullable();
    table.string('status', 20).notNullable().defaultTo('issued');
    table.string('qr_version', 10).notNullable().defaultTo('v1');
    table.timestamp('issued_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp('used_at', { useTz: true }).nullable();
    table.uuid('used_by').nullable().references('id').inTable('users').onDelete('RESTRICT');

    table.unique(['order_item_id', 'ticket_number'], { indexName: 'event_tickets_order_item_number_unique' });
    table.index(['event_id', 'status'], 'event_tickets_event_status_index');
    table.check('ticket_number > 0', [], 'event_tickets_ticket_number_check');
    table.check("status in ('issued', 'used', 'void')", [], 'event_tickets_status_check');
    table.check("qr_version in ('v1')", [], 'event_tickets_qr_version_check');
    table.check('(used_at is null) = (used_by is null)', [], 'event_tickets_usage_actor_pair_check');
    table.check("(status = 'issued' and used_at is null and used_by is null) or (status = 'used' and used_at is not null and used_by is not null) or status = 'void'", [], 'event_tickets_status_usage_check');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTable('event_tickets');
  await knex.schema.alterTable('order_items', (table) => {
    table.dropColumn('event_title_snapshot');
    table.dropColumn('ticket_type_name_snapshot');
  });
}
