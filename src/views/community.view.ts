import type { CommunityRecord } from '../models/community.model';
import type { CommunityWithRelations } from '../models/community-relation.model';

export interface PublicCommunityDisciplineSport {
  readonly id: number;
  readonly disciplineSportId: number;
  readonly name: string;
  readonly createdAt: string;
}

export interface PublicCommunityLocation {
  readonly id: number;
  readonly cityId: number | null;
  readonly urlGmapsLocations: string | null;
  readonly isPrimary: boolean;
  readonly createdAt: string;
}

export interface PublicCommunitySchedule {
  readonly id: number;
  readonly dayOfWeek: number;
  readonly startTime: string;
  readonly endTime: string;
  readonly locationId: number | null;
  readonly createdAt: string;
}

export interface PublicCommunitySocialLink {
  readonly id: number;
  readonly platform: string;
  readonly url: string;
  readonly createdAt: string;
}

export interface PublicCommunity {
  readonly id: string;
  readonly name: string;
  readonly slug: string;
  readonly description: string | null;
  readonly logoUrl: string | null;
  readonly coverUrl: string | null;
  readonly cityId: number | null;
  readonly ownerUserId: string | null;
  readonly visibility: 'public' | 'private';
  readonly status: 'draft' | 'active' | 'inactive' | 'suspended';
  readonly contactPerson: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly disciplineSports: readonly PublicCommunityDisciplineSport[];
  readonly locations: readonly PublicCommunityLocation[];
  readonly schedules: readonly PublicCommunitySchedule[];
  readonly socialLinks: readonly PublicCommunitySocialLink[];
}

export const presentCommunity = (community: CommunityRecord | CommunityWithRelations): PublicCommunity => ({
  id: community.id,
  name: community.name,
  slug: community.slug,
  description: community.description,
  logoUrl: community.logo_url,
  coverUrl: community.cover_url,
  cityId: community.city_id,
  ownerUserId: community.owner_user_id,
  visibility: community.visibility,
  status: community.status,
  contactPerson: community.contact_person,
  createdAt: new Date(community.created_at).toISOString(),
  updatedAt: new Date(community.updated_at).toISOString(),
  disciplineSports: 'relations' in community
    ? community.relations.disciplineSports.map((disciplineSport) => ({
      id: disciplineSport.id,
      disciplineSportId: disciplineSport.discipline_sport_id,
      name: disciplineSport.discipline_sport_name,
      createdAt: new Date(disciplineSport.created_at).toISOString(),
    }))
    : [],
  locations: 'relations' in community
    ? community.relations.locations.map((location) => ({
      id: location.id,
      cityId: location.city_id,
      urlGmapsLocations: location.url_gmaps_locations,
      isPrimary: location.is_primary,
      createdAt: new Date(location.created_at).toISOString(),
    }))
    : [],
  schedules: 'relations' in community
    ? community.relations.schedules.map((schedule) => ({
      id: schedule.id,
      dayOfWeek: schedule.day_of_week,
      startTime: schedule.start_time,
      endTime: schedule.end_time,
      locationId: schedule.location_id,
      createdAt: new Date(schedule.created_at).toISOString(),
    }))
    : [],
  socialLinks: 'relations' in community
    ? community.relations.socialLinks.map((socialLink) => ({
      id: socialLink.id,
      platform: socialLink.platform,
      url: socialLink.url,
      createdAt: new Date(socialLink.created_at).toISOString(),
    }))
    : [],
});
