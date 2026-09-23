import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  // Existing accounts are treated as verified for backward compatibility. This is
  // an operational migration decision, not historical proof of email ownership.
  await knex.schema.alterTable('users', (table) => {
    table.boolean('is_email_verified').notNullable().defaultTo(true);
  });
  await knex('users').update({ is_email_verified: true });
  await knex.raw('alter table users alter column is_email_verified set default false');

  await knex.schema.createTable('user_email_verification_otps', (table) => {
    table.uuid('user_id').primary().references('id').inTable('users').onDelete('CASCADE');
    table.specificType('code_hash', 'char(64)').notNullable();
    table.timestamp('expires_at', { useTz: true }).notNullable();
    table.timestamp('sent_at', { useTz: true }).notNullable();
    table.integer('failed_attempts').notNullable().defaultTo(0);
    table.timestamp('send_window_started_at', { useTz: true }).notNullable();
    table.integer('send_count').notNullable().defaultTo(1);
    table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.check('failed_attempts between 0 and 5', [], 'user_email_verification_otps_failed_attempts_check');
    table.check('send_count between 1 and 5', [], 'user_email_verification_otps_send_count_check');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('user_email_verification_otps');
  await knex.schema.alterTable('users', (table) => {
    table.dropColumn('is_email_verified');
  });
}
