import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('orders', (table) => {
    table.uuid('checkout_key').nullable();
    table.string('request_fingerprint', 64).nullable();
    table.unique(['user_id', 'checkout_key'], 'orders_user_id_checkout_key_unique');
  });

  await knex.schema.alterTable('payment_transactions', (table) => {
    table.text('payment_link_url').nullable();
    table.integer('provider_fee_amount').nullable();
    table.integer('provider_net_amount').nullable();
    table.string('initiation_state', 20).nullable();
    table.timestamp('initiation_started_at', { useTz: true }).nullable();
    table.check('provider_fee_amount is null or provider_fee_amount >= 0', [], 'payment_transactions_provider_fee_amount_check');
    table.check('provider_net_amount is null or provider_net_amount >= 0', [], 'payment_transactions_provider_net_amount_check');
    table.check("initiation_state is null or initiation_state in ('processing', 'ready', 'unknown', 'rejected')", [], 'payment_transactions_initiation_state_check');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('payment_transactions', (table) => {
    table.dropChecks([
      'payment_transactions_provider_fee_amount_check',
      'payment_transactions_provider_net_amount_check',
      'payment_transactions_initiation_state_check',
    ]);
    table.dropColumns('payment_link_url', 'provider_fee_amount', 'provider_net_amount', 'initiation_state', 'initiation_started_at');
  });
  await knex.schema.alterTable('orders', (table) => {
    table.dropUnique(['user_id', 'checkout_key'], 'orders_user_id_checkout_key_unique');
    table.dropColumns('checkout_key', 'request_fingerprint');
  });
}
