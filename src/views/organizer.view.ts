import type { OrganizerRecord } from '../models/organizer.model';

export interface PublicOrganizer {
  readonly id: string;
  readonly name: string;
  readonly userId: string | null;
  readonly communityId: string | null;
  readonly logoUrl: string | null;
  readonly email: string | null;
  readonly phone: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export const presentOrganizer = (organizer: OrganizerRecord): PublicOrganizer => ({
  id: organizer.id,
  name: organizer.name,
  userId: organizer.user_id,
  communityId: organizer.community_id,
  logoUrl: organizer.logo_url,
  email: organizer.email,
  phone: organizer.phone,
  createdAt: new Date(organizer.created_at).toISOString(),
  updatedAt: new Date(organizer.updated_at).toISOString(),
});
