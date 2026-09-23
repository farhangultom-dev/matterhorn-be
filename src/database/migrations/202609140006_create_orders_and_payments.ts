import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('orders', (table) => {
    table.uuid('id').primary();
    table.uuid('user_id').notNullable().references('id').inTable('users').onDelete('RESTRICT');
    table.integer('subtotal_amount').notNullable();
    table.integer('fee_amount').notNullable();
    table.integer('total_amount').notNullable();
    table.string('status', 30).notNullable().defaultTo('pending');
    table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp('paid_at', { useTz: true }).nullable();
    table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.index(['user_id'], 'orders_user_id_index');
    table.index(['status'], 'orders_status_index');
    table.index(['created_at'], 'orders_created_at_index');
    table.check('subtotal_amount >= 0', [], 'orders_subtotal_amount_check');
    table.check('fee_amount >= 0', [], 'orders_fee_amount_check');
    table.check('total_amount >= 0', [], 'orders_total_amount_check');
    table.check('total_amount = subtotal_amount + fee_amount', [], 'orders_total_amount_math_check');
    table.check("status in ('pending', 'paid', 'cancelled', 'expired', 'refunded')", [], 'orders_status_check');
  });

  await knex.schema.createTable('order_items', (table) => {
    table.uuid('id').primary();
    table.uuid('order_id').notNullable().references('id').inTable('orders').onDelete('CASCADE');
    table.uuid('event_ticket_type_id').notNullable().references('id').inTable('event_ticket_types').onDelete('RESTRICT');
    table.integer('quantity').notNullable();
    table.integer('unit_price').notNullable();
    table.integer('subtotal').notNullable();
    table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.unique(['order_id', 'event_ticket_type_id'], { indexName: 'order_items_order_id_ticket_type_id_unique' });
    table.index(['event_ticket_type_id'], 'order_items_ticket_type_id_index');
    table.check('quantity > 0', [], 'order_items_quantity_check');
    table.check('unit_price >= 0', [], 'order_items_unit_price_check');
    table.check('subtotal >= 0', [], 'order_items_subtotal_check');
    table.check('subtotal = quantity * unit_price', [], 'order_items_subtotal_math_check');
  });

  await knex.schema.createTable('payment_transactions', (table) => {
    table.increments('id').primary();
    table.uuid('order_id').notNullable().references('id').inTable('orders').onDelete('RESTRICT');
    table.string('provider', 50).notNullable();
    table.string('provider_reference', 150).nullable().unique('payment_transactions_provider_reference_unique');
    table.string('merchant_reference', 150).notNullable().unique('payment_transactions_merchant_reference_unique');
    table.integer('amount').notNullable();
    table.string('status', 30).notNullable().defaultTo('pending');
    table.timestamp('expires_at', { useTz: true }).nullable();
    table.timestamp('paid_at', { useTz: true }).nullable();
    table.timestamp('cancelled_at', { useTz: true }).nullable();
    table.index(['order_id'], 'payment_transactions_order_id_index');
    table.index(['status'], 'payment_transactions_status_index');
    table.check('amount > 0', [], 'payment_transactions_amount_check');
    table.check("status in ('pending', 'paid', 'failed', 'expired', 'cancelled', 'refunded')", [], 'payment_transactions_status_check');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTable('payment_transactions');
  await knex.schema.dropTable('order_items');
  await knex.schema.dropTable('orders');
}
