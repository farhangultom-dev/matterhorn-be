import type { Knex } from 'knex';

export interface CheckInEventRecord {
  readonly id: string;
  readonly organizer_id: string;
  readonly starts_at: Date;
  readonly ends_at: Date;
  readonly deleted_at: Date | null;
  readonly organizer_deleted_at: Date | null;
}

export const findCheckInEvent = async (transaction: Knex.Transaction, eventId: string): Promise<CheckInEventRecord | undefined> =>
  transaction<CheckInEventRecord>('events as e')
    .join('organizers as org', 'org.id', 'e.organizer_id')
    .select('e.id', 'e.organizer_id', 'e.starts_at', 'e.ends_at', 'e.deleted_at', 'org.deleted_at as organizer_deleted_at')
    .where('e.id', eventId)
    .first();

export const hasEventCheckInAccess = async (
  transaction: Knex.Transaction,
  eventId: string,
  userId: string,
): Promise<boolean> => {
  const roles = await transaction('user_roles as ur')
    .join('roles as r', 'r.id', 'ur.role_id')
    .join('users as u', 'u.id', 'ur.user_id')
    .select('ur.role_id')
    .where('ur.user_id', userId)
    .whereIn('ur.role_id', [1, 4])
    .whereNull('ur.deleted_at')
    .whereNull('r.deleted_at')
    .whereNull('u.deleted_at');
  if (roles.some((role) => Number(role.role_id) === 1)) return true;
  if (!roles.some((role) => Number(role.role_id) === 4)) return false;

  const ownedOrganizer = await transaction('organizers as org')
    .leftJoin('communities as c', 'c.id', 'org.community_id')
    .join('events as e', 'e.organizer_id', 'org.id')
    .select('org.id')
    .where('e.id', eventId)
    .whereNull('e.deleted_at')
    .whereNull('org.deleted_at')
    .andWhere((query) => query
      .where('org.user_id', userId)
      .orWhere((communityOwner) => communityOwner
        .whereNotNull('org.community_id')
        .where('c.owner_user_id', userId)
        .where('c.status', 'active')
        .whereNull('c.deleted_at')))
    .first();
  return ownedOrganizer !== undefined;
};
