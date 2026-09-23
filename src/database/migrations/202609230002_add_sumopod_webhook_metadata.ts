import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('payment_transactions', (table) => {
    table.string('payment_method', 50).nullable();
    table.timestamp('settled_at', { useTz: true }).nullable();
    table.timestamp('completed_at', { useTz: true }).nullable();
    table.string('last_webhook_event_type', 50).nullable();
    table.timestamp('last_webhook_received_at', { useTz: true }).nullable();
    table.check(
      "last_webhook_event_type is null or last_webhook_event_type in ('payment.completed', 'payment.failed', 'payment.expired')",
      [],
      'payment_transactions_last_webhook_event_type_check',
    );
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('payment_transactions', (table) => {
    table.dropChecks(['payment_transactions_last_webhook_event_type_check']);
    table.dropColumns('payment_method', 'settled_at', 'completed_at', 'last_webhook_event_type', 'last_webhook_received_at');
  });
}
