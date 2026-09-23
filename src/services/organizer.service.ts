import { randomUUID } from 'node:crypto';
import { getDatabase } from '../config/database';
import { hasAnyActiveRoleId } from '../models/user-role.model';
import { OrganizerCommunityNotFoundError, OrganizerUserNotFoundError, findOrganizerForUpdate, insertOrganizer, isOrganizerCommunityForeignKeyError, isOrganizerUserForeignKeyError, softDeleteOrganizer, updateOrganizer as updateOrganizerRecord, validateOrganizerReferences, type OrganizerCreateValues, type OrganizerRecord, type OrganizerUpdateValues } from '../models/organizer.model';
import type { CreateOrganizerInput, UpdateOrganizerInput } from '../validations/organizer.validation';
import { AppError } from '../utils/app-error';
import { deleteUploadedOrganizerLogo, uploadOrganizerLogo, type OrganizerLogoFile, type UploadedOrganizerLogo } from './organizer-logo-storage.service';
import { StorageUnavailableError } from './profile-photo-storage.service';

const ORGANIZER_MUTATION_ROLE_IDS = [1, 4] as const;

const assertOrganizerMutationAccess = async (actorUserId: string): Promise<void> => {
  if (!(await hasAnyActiveRoleId(actorUserId, ORGANIZER_MUTATION_ROLE_IDS))) {
    throw new AppError(403, 'FORBIDDEN', 'Role ID 1 or 4 is required');
  }
};

const mapReferenceError = (error: unknown): never => {
  if (error instanceof OrganizerUserNotFoundError || isOrganizerUserForeignKeyError(error)) {
    throw new AppError(400, 'INVALID_USER', 'User is not active');
  }
  if (error instanceof OrganizerCommunityNotFoundError || isOrganizerCommunityForeignKeyError(error)) {
    throw new AppError(400, 'INVALID_COMMUNITY', 'Community is not active');
  }
  throw error;
};

const hasField = <T extends object>(input: T, field: keyof T): boolean => Object.prototype.hasOwnProperty.call(input, field);

const toCreateValues = (input: CreateOrganizerInput): OrganizerCreateValues => ({
  id: randomUUID(),
  name: input.name,
  user_id: input.userId ?? null,
  community_id: input.communityId ?? null,
  logo_url: input.logoUrl ?? null,
  email: input.email ?? null,
  phone: input.phone ?? null,
});

const toUpdateValues = (input: UpdateOrganizerInput): OrganizerUpdateValues => ({
  ...(input.name !== undefined ? { name: input.name } : {}),
  ...(hasField(input, 'userId') ? { user_id: input.userId ?? null } : {}),
  ...(hasField(input, 'communityId') ? { community_id: input.communityId ?? null } : {}),
  ...(hasField(input, 'logoUrl') ? { logo_url: input.logoUrl ?? null } : {}),
  ...(hasField(input, 'email') ? { email: input.email ?? null } : {}),
  ...(hasField(input, 'phone') ? { phone: input.phone ?? null } : {}),
});

export const createOrganizer = async (actorUserId: string, input: CreateOrganizerInput, file?: OrganizerLogoFile): Promise<OrganizerRecord> => {
  await assertOrganizerMutationAccess(actorUserId);
  const baseValues = toCreateValues(input);
  if (file && input.logoUrl !== undefined && input.logoUrl !== null) {
    throw new AppError(400, 'INVALID_UPLOAD', 'Provide either logo file or logoUrl, not both');
  }
  let uploaded: UploadedOrganizerLogo | undefined;
  let committed = false;
  try {
    if (file) uploaded = await uploadOrganizerLogo({ organizerId: baseValues.id, file });
    const values: OrganizerCreateValues = { ...baseValues, logo_url: uploaded?.url ?? baseValues.logo_url };
    const organizer = await getDatabase().transaction(async (transaction) => {
      await validateOrganizerReferences(transaction, values);
      return insertOrganizer(transaction, values);
    });
    committed = true;
    return organizer;
  } catch (error) {
    if (uploaded && !committed) {
      try {
        await deleteUploadedOrganizerLogo(uploaded.key);
      } catch {
        // Preserve the original failure; cleanup is best effort.
      }
    }
    if (error instanceof StorageUnavailableError) throw new AppError(503, 'STORAGE_UNAVAILABLE', 'Organizer logo storage is unavailable');
    return mapReferenceError(error);
  }
};

export const updateOrganizer = async (actorUserId: string, organizerId: string, input: UpdateOrganizerInput): Promise<OrganizerRecord> => {
  await assertOrganizerMutationAccess(actorUserId);
  const values = toUpdateValues(input);
  try {
    return await getDatabase().transaction(async (transaction) => {
      const current = await findOrganizerForUpdate(transaction, organizerId);
      if (!current) throw new AppError(404, 'ORGANIZER_NOT_FOUND', 'Organizer not found');

      await validateOrganizerReferences(transaction, {
        user_id: hasField(input, 'userId') ? input.userId ?? null : null,
        community_id: hasField(input, 'communityId') ? input.communityId ?? null : null,
      });
      return updateOrganizerRecord(transaction, organizerId, values);
    });
  } catch (error) {
    return mapReferenceError(error);
  }
};

export const deleteOrganizer = async (actorUserId: string, organizerId: string): Promise<void> => {
  await assertOrganizerMutationAccess(actorUserId);
  await getDatabase().transaction(async (transaction) => {
    const current = await findOrganizerForUpdate(transaction, organizerId);
    if (!current) throw new AppError(404, 'ORGANIZER_NOT_FOUND', 'Organizer not found');
    await softDeleteOrganizer(transaction, organizerId);
  });
};
