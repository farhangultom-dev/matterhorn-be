import type { Knex } from 'knex';

const ownerConstraint = 'organizers_owner_check';

export async function up(knex: Knex): Promise<void> {
  await knex.raw(`alter table organizers drop constraint if exists ${ownerConstraint}`);
}

export async function down(knex: Knex): Promise<void> {
  const invalidOrganizer = await knex('organizers')
    .select('id')
    .whereNull('user_id')
    .whereNull('community_id')
    .first();

  if (invalidOrganizer) {
    throw new Error(`Cannot restore ${ownerConstraint}: organizer ${invalidOrganizer.id} has both user_id and community_id set to NULL.`);
  }

  await knex.raw(`alter table organizers add constraint ${ownerConstraint} check (user_id is not null or community_id is not null)`);
}
