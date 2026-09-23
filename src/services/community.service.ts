import { randomUUID } from 'node:crypto';
import { getDatabase } from '../config/database';
import { hasActiveRole, hasAnyActiveRole } from '../models/user-role.model';
import { findActiveCityInTransaction, findCommunityForMediaAuthorization, findCommunityForUpdate, findPublicCommunities, findPublicCommunityById, insertCommunity, isUniqueCommunitySlugError, softDeleteCommunity, updateCommunity as updateCommunityRecord, type CommunityCreateValues, type CommunityListFilters, type CommunityRecord, type CommunityUpdateValues } from '../models/community.model';
import { CommunityDisciplineSportAlreadyExistsError, CommunityLocationCityNotFoundError, CommunityPrimaryLocationAlreadyExistsError, CommunityScheduleAlreadyExistsError, CommunityScheduleLocationNotFoundError, CommunitySocialLinkAlreadyExistsError, DisciplineSportNotFoundError, findCommunityRelations, insertCommunityDisciplineSport, insertCommunityLocation, insertCommunitySchedule, insertCommunitySocialLink, isUniqueCommunityPrimaryLocationError, type CommunityDisciplineSportRecord, type CommunityLocationRecord, type CommunityScheduleRecord, type CommunitySocialLinkRecord, type CommunityWithRelations } from '../models/community-relation.model';
import { deleteManagedCommunityMediaByUrl, deleteUploadedCommunityMedia, uploadCommunityMedia, type CommunityMediaFile, type CommunityMediaKind, type UploadedCommunityMedia } from './community-media-storage.service';
import { StorageUnavailableError } from './profile-photo-storage.service';
import type { AddCommunityDisciplineSportInput, AddCommunityLocationInput, AddCommunityScheduleInput, AddCommunitySocialLinkInput, CreateCommunityInput, UpdateCommunityInput } from '../validations/community.validation';
import { AppError } from '../utils/app-error';

export const attachCommunityRelations = async (communities: readonly CommunityRecord[]): Promise<CommunityWithRelations[]> => {
  const relationsByCommunity = await findCommunityRelations(communities.map((community) => community.id));
  return communities.map((community) => ({
    ...community,
    relations: relationsByCommunity.get(community.id) ?? {
      disciplineSports: [],
      locations: [],
      schedules: [],
      socialLinks: [],
    },
  }));
};

export const listPublicCommunities = async (filters: CommunityListFilters): Promise<{ rows: CommunityWithRelations[]; total: number }> => {
  const result = await findPublicCommunities(filters);
  return { rows: await attachCommunityRelations(result.rows), total: result.total };
};

export const getPublicCommunity = async (communityId: string): Promise<CommunityWithRelations> => {
  const community = await findPublicCommunityById(communityId);
  if (!community) throw new AppError(404, 'COMMUNITY_NOT_FOUND', 'Community not found');
  const [communityWithRelations] = await attachCommunityRelations([community]);
  return communityWithRelations!;
};

class InvalidCommunityCityError extends Error {
  public constructor() {
    super('City is not active or does not belong to an active province');
    this.name = 'InvalidCommunityCityError';
  }
}

const assertCommunityMutationAccess = (actorUserId: string, community: CommunityRecord, isAdmin: boolean): void => {
  if (!isAdmin && community.owner_user_id !== actorUserId) throw new AppError(403, 'FORBIDDEN', 'Community owner or admin role is required');
  if (!isAdmin && community.status === 'suspended') throw new AppError(403, 'FORBIDDEN', 'Only an admin can modify a suspended community');
};

export const createCommunity = async (actorUserId: string, input: CreateCommunityInput): Promise<CommunityWithRelations> => {
  if (!(await hasAnyActiveRole(actorUserId, ['community_owner', 'admin']))) {
    throw new AppError(403, 'FORBIDDEN', 'Community owner or admin role is required');
  }

  const values: CommunityCreateValues = {
    id: randomUUID(),
    name: input.name,
    slug: input.slug,
    description: input.description ?? null,
    logo_url: input.logoUrl ?? null,
    cover_url: input.coverUrl ?? null,
    city_id: input.cityId ?? null,
    owner_user_id: actorUserId,
    visibility: input.visibility,
    status: 'draft',
    contact_person: input.contactPerson ?? null,
  };

  try {
    const community = await getDatabase().transaction(async (transaction) => {
      if (values.city_id !== null && !(await findActiveCityInTransaction(transaction, values.city_id))) throw new InvalidCommunityCityError();
      return insertCommunity(transaction, values);
    });
    const [communityWithRelations] = await attachCommunityRelations([community]);
    return communityWithRelations!;
  } catch (error) {
    if (error instanceof InvalidCommunityCityError) throw new AppError(400, 'INVALID_CITY', error.message);
    if (isUniqueCommunitySlugError(error)) throw new AppError(409, 'COMMUNITY_SLUG_EXISTS', 'Community slug is already in use');
    throw error;
  }
};

const hasField = <T extends object>(input: T, field: keyof T): boolean => Object.prototype.hasOwnProperty.call(input, field);

const mapCommunityUpdateValues = (input: UpdateCommunityInput): CommunityUpdateValues => ({
  ...(input.name !== undefined ? { name: input.name } : {}),
  ...(input.slug !== undefined ? { slug: input.slug } : {}),
  ...(hasField(input, 'description') ? { description: input.description ?? null } : {}),
  ...(hasField(input, 'logoUrl') ? { logo_url: input.logoUrl ?? null } : {}),
  ...(hasField(input, 'coverUrl') ? { cover_url: input.coverUrl ?? null } : {}),
  ...(hasField(input, 'cityId') ? { city_id: input.cityId ?? null } : {}),
  ...(input.visibility !== undefined ? { visibility: input.visibility } : {}),
  ...(input.status !== undefined ? { status: input.status } : {}),
  ...(hasField(input, 'contactPerson') ? { contact_person: input.contactPerson ?? null } : {}),
});

export const updateCommunity = async (actorUserId: string, communityId: string, input: UpdateCommunityInput): Promise<CommunityWithRelations> => {
  const isAdmin = await hasActiveRole(actorUserId, 'admin');
  let oldLogoUrl: string | null = null;
  let oldCoverUrl: string | null = null;
  try {
    const community = await getDatabase().transaction(async (transaction) => {
      const current = await findCommunityForUpdate(transaction, communityId);
      if (!current) throw new AppError(404, 'COMMUNITY_NOT_FOUND', 'Community not found');
      assertCommunityMutationAccess(actorUserId, current, isAdmin);
      if (!isAdmin && input.status === 'suspended') throw new AppError(403, 'FORBIDDEN', 'Only an admin can suspend a community');

      oldLogoUrl = current.logo_url;
      oldCoverUrl = current.cover_url;
      const values = mapCommunityUpdateValues(input);
      if (values.city_id !== undefined && values.city_id !== null && !(await findActiveCityInTransaction(transaction, values.city_id))) {
        throw new InvalidCommunityCityError();
      }
      return updateCommunityRecord(transaction, communityId, values);
    });
    if (hasField(input, 'logoUrl') && oldLogoUrl && oldLogoUrl !== community.logo_url) {
      await deleteManagedCommunityMediaByUrl({ communityId, kind: 'logo', url: oldLogoUrl });
    }
    if (hasField(input, 'coverUrl') && oldCoverUrl && oldCoverUrl !== community.cover_url) {
      await deleteManagedCommunityMediaByUrl({ communityId, kind: 'cover', url: oldCoverUrl });
    }
    const [communityWithRelations] = await attachCommunityRelations([community]);
    return communityWithRelations!;
  } catch (error) {
    if (error instanceof InvalidCommunityCityError) throw new AppError(400, 'INVALID_CITY', error.message);
    if (isUniqueCommunitySlugError(error)) throw new AppError(409, 'COMMUNITY_SLUG_EXISTS', 'Community slug is already in use');
    throw error;
  }
};

const getCommunityMediaColumn = (kind: CommunityMediaKind): 'logo_url' | 'cover_url' => kind === 'logo' ? 'logo_url' : 'cover_url';

export const updateCommunityMedia = async ({ actorUserId, communityId, kind, file }: { actorUserId: string; communityId: string; kind: CommunityMediaKind; file: CommunityMediaFile }): Promise<CommunityWithRelations> => {
  const current = await findCommunityForMediaAuthorization(communityId);
  if (!current) throw new AppError(404, 'COMMUNITY_NOT_FOUND', 'Community not found');
  const isAdminBeforeUpload = await hasActiveRole(actorUserId, 'admin');
  assertCommunityMutationAccess(actorUserId, current, isAdminBeforeUpload);

  let uploaded: UploadedCommunityMedia | undefined;
  let oldMediaUrl: string | null = null;
  let committed = false;
  try {
    uploaded = await uploadCommunityMedia({ communityId, kind, file });
    const isAdminAfterUpload = await hasActiveRole(actorUserId, 'admin');
    const updated = await getDatabase().transaction(async (transaction) => {
      const locked = await findCommunityForUpdate(transaction, communityId);
      if (!locked) throw new AppError(404, 'COMMUNITY_NOT_FOUND', 'Community not found');
      assertCommunityMutationAccess(actorUserId, locked, isAdminAfterUpload);
      const column = getCommunityMediaColumn(kind);
      oldMediaUrl = locked[column];
      return updateCommunityRecord(transaction, communityId, { [column]: uploaded!.url });
    });
    committed = true;

    if (oldMediaUrl && oldMediaUrl !== uploaded.url) {
      await deleteManagedCommunityMediaByUrl({ communityId, kind, url: oldMediaUrl });
    }
    const [communityWithRelations] = await attachCommunityRelations([updated]);
    return communityWithRelations!;
  } catch (error) {
    if (uploaded && !committed) {
      try {
        await deleteUploadedCommunityMedia(uploaded.key);
      } catch {
        // Preserve the original failure; rollback cleanup is best effort.
      }
    }
    if (error instanceof StorageUnavailableError) throw new AppError(503, 'STORAGE_UNAVAILABLE', 'Community media storage is unavailable');
    throw error;
  }
};

export const updateCommunityLogo = async (actorUserId: string, communityId: string, file: CommunityMediaFile): Promise<CommunityWithRelations> =>
  updateCommunityMedia({ actorUserId, communityId, kind: 'logo', file });

export const updateCommunityCover = async (actorUserId: string, communityId: string, file: CommunityMediaFile): Promise<CommunityWithRelations> =>
  updateCommunityMedia({ actorUserId, communityId, kind: 'cover', file });

export const addCommunityDisciplineSport = async (
  actorUserId: string,
  communityId: string,
  input: AddCommunityDisciplineSportInput,
): Promise<CommunityDisciplineSportRecord> => {
  const isAdmin = await hasActiveRole(actorUserId, 'admin');
  try {
    return await getDatabase().transaction(async (transaction) => {
      const community = await findCommunityForUpdate(transaction, communityId);
      if (!community) throw new AppError(404, 'COMMUNITY_NOT_FOUND', 'Community not found');
      assertCommunityMutationAccess(actorUserId, community, isAdmin);
      return insertCommunityDisciplineSport(transaction, communityId, input.disciplineSportId);
    });
  } catch (error) {
    if (error instanceof DisciplineSportNotFoundError) {
      throw new AppError(404, 'DISCIPLINE_SPORT_NOT_FOUND', 'Discipline sport not found');
    }
    if (error instanceof CommunityDisciplineSportAlreadyExistsError) {
      throw new AppError(409, 'COMMUNITY_DISCIPLINE_SPORT_ALREADY_EXISTS', 'Community already has this discipline sport');
    }
    throw error;
  }
};

export const addCommunityLocation = async (
  actorUserId: string,
  communityId: string,
  input: AddCommunityLocationInput,
): Promise<CommunityLocationRecord> => {
  const isAdmin = await hasActiveRole(actorUserId, 'admin');
  try {
    return await getDatabase().transaction(async (transaction) => {
      const community = await findCommunityForUpdate(transaction, communityId);
      if (!community) throw new AppError(404, 'COMMUNITY_NOT_FOUND', 'Community not found');
      assertCommunityMutationAccess(actorUserId, community, isAdmin);
      return insertCommunityLocation(transaction, communityId, {
        city_id: input.cityId ?? null,
        url_gmaps_locations: input.urlGmapsLocations ?? null,
        is_primary: input.isPrimary,
      });
    });
  } catch (error) {
    if (error instanceof CommunityLocationCityNotFoundError) {
      throw new AppError(400, 'INVALID_CITY', error.message);
    }
    if (error instanceof CommunityPrimaryLocationAlreadyExistsError || isUniqueCommunityPrimaryLocationError(error)) {
      throw new AppError(409, 'COMMUNITY_PRIMARY_LOCATION_ALREADY_EXISTS', 'Community already has an active primary location');
    }
    throw error;
  }
};

export const addCommunitySchedule = async (
  actorUserId: string,
  communityId: string,
  input: AddCommunityScheduleInput,
): Promise<CommunityScheduleRecord> => {
  const isAdmin = await hasActiveRole(actorUserId, 'admin');
  try {
    return await getDatabase().transaction(async (transaction) => {
      const community = await findCommunityForUpdate(transaction, communityId);
      if (!community) throw new AppError(404, 'COMMUNITY_NOT_FOUND', 'Community not found');
      assertCommunityMutationAccess(actorUserId, community, isAdmin);
      return insertCommunitySchedule(transaction, communityId, {
        day_of_week: input.dayOfWeek,
        start_time: input.startTime,
        end_time: input.endTime,
        location_id: input.locationId ?? null,
      });
    });
  } catch (error) {
    if (error instanceof CommunityScheduleLocationNotFoundError) {
      throw new AppError(400, 'INVALID_LOCATION', error.message);
    }
    if (error instanceof CommunityScheduleAlreadyExistsError) {
      throw new AppError(409, 'COMMUNITY_SCHEDULE_ALREADY_EXISTS', 'Community already has this schedule');
    }
    throw error;
  }
};

export const addCommunitySocialLink = async (
  actorUserId: string,
  communityId: string,
  input: AddCommunitySocialLinkInput,
): Promise<CommunitySocialLinkRecord> => {
  const isAdmin = await hasActiveRole(actorUserId, 'admin');
  try {
    return await getDatabase().transaction(async (transaction) => {
      const community = await findCommunityForUpdate(transaction, communityId);
      if (!community) throw new AppError(404, 'COMMUNITY_NOT_FOUND', 'Community not found');
      assertCommunityMutationAccess(actorUserId, community, isAdmin);
      return insertCommunitySocialLink(transaction, communityId, input);
    });
  } catch (error) {
    if (error instanceof CommunitySocialLinkAlreadyExistsError) {
      throw new AppError(409, 'COMMUNITY_SOCIAL_LINK_ALREADY_EXISTS', 'Community already has a social link for this platform');
    }
    throw error;
  }
};

export const deleteCommunity = async (actorUserId: string, communityId: string): Promise<void> => {
  const isAdmin = await hasActiveRole(actorUserId, 'admin');
  await getDatabase().transaction(async (transaction) => {
    const current = await findCommunityForUpdate(transaction, communityId);
    if (!current) throw new AppError(404, 'COMMUNITY_NOT_FOUND', 'Community not found');
    if (!isAdmin && current.owner_user_id !== actorUserId) throw new AppError(403, 'FORBIDDEN', 'Community owner or admin role is required');
    if (!isAdmin && current.status === 'suspended') throw new AppError(403, 'FORBIDDEN', 'Only an admin can delete a suspended community');
    await softDeleteCommunity(transaction, communityId);
  });
};
