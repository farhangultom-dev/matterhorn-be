import type { CommunityDisciplineSportRecord, CommunityLocationRecord, CommunityScheduleRecord, CommunitySocialLinkRecord } from '../models/community-relation.model';

export interface PublicCommunityDisciplineSport {
  readonly id: number;
  readonly communityId: string;
  readonly disciplineSportId: number;
  readonly disciplineSportName: string;
  readonly createdAt: string;
}

export const presentCommunityDisciplineSport = (relation: CommunityDisciplineSportRecord): PublicCommunityDisciplineSport => ({
  id: relation.id,
  communityId: relation.community_id,
  disciplineSportId: relation.discipline_sport_id,
  disciplineSportName: relation.discipline_sport_name,
  createdAt: new Date(relation.created_at).toISOString(),
});

export interface PublicCommunityLocation {
  readonly id: number;
  readonly communityId: string;
  readonly cityId: number | null;
  readonly urlGmapsLocations: string | null;
  readonly isPrimary: boolean;
  readonly createdAt: string;
}

export const presentCommunityLocation = (location: CommunityLocationRecord): PublicCommunityLocation => ({
  id: location.id,
  communityId: location.community_id,
  cityId: location.city_id,
  urlGmapsLocations: location.url_gmaps_locations,
  isPrimary: location.is_primary,
  createdAt: new Date(location.created_at).toISOString(),
});

export interface PublicCommunitySchedule {
  readonly id: number;
  readonly communityId: string;
  readonly dayOfWeek: number;
  readonly startTime: string;
  readonly endTime: string;
  readonly locationId: number | null;
  readonly createdAt: string;
}

export const presentCommunitySchedule = (schedule: CommunityScheduleRecord): PublicCommunitySchedule => ({
  id: schedule.id,
  communityId: schedule.community_id,
  dayOfWeek: schedule.day_of_week,
  startTime: schedule.start_time,
  endTime: schedule.end_time,
  locationId: schedule.location_id,
  createdAt: new Date(schedule.created_at).toISOString(),
});

export interface PublicCommunitySocialLink {
  readonly id: number;
  readonly communityId: string;
  readonly platform: string;
  readonly url: string;
  readonly createdAt: string;
}

export const presentCommunitySocialLink = (socialLink: CommunitySocialLinkRecord): PublicCommunitySocialLink => ({
  id: socialLink.id,
  communityId: socialLink.community_id,
  platform: socialLink.platform,
  url: socialLink.url,
  createdAt: new Date(socialLink.created_at).toISOString(),
});
