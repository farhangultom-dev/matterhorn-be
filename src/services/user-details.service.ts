import { getDatabase } from '../config/database';
import { AppError } from '../utils/app-error';
import { findActiveCity, findActiveCityInTransaction, findActiveUser, findActiveUserForUpdate, findUserDetailsByUserId, type UserDetailsRecord, type UserDetailsValues, upsertUserDetails, updateUserName } from '../models/user-details.model';
import type { UpdateUserDetailsInput } from '../validations/user-details.validation';
import { deleteManagedProfilePhotoByUrl, deleteUploadedProfilePhoto, uploadProfilePhoto, type ProfilePhotoFile, type UploadedProfilePhoto, StorageUnavailableError } from './profile-photo-storage.service';

export class InvalidCityError extends Error {
  public constructor() {
    super('City is not active or does not belong to an active province');
    this.name = 'InvalidCityError';
  }
}

export class UserNotFoundError extends Error {
  public constructor() {
    super('User is not active');
    this.name = 'UserNotFoundError';
  }
}

const hasField = (input: UpdateUserDetailsInput, field: keyof UpdateUserDetailsInput): boolean => Object.prototype.hasOwnProperty.call(input, field);

export const updateUserDetails = async ({ userId, input, file }: { userId: string; input: UpdateUserDetailsInput; file?: ProfilePhotoFile }): Promise<UserDetailsRecord> => {
  const activeUser = await findActiveUser(userId);
  if (!activeUser) throw new AppError(401, 'UNAUTHORIZED', 'Authentication required');
  const requestedCityId = input.cityId;
  if (hasField(input, 'cityId') && requestedCityId !== null && requestedCityId !== undefined) {
    const city = await findActiveCity(requestedCityId);
    if (!city) throw new AppError(400, 'INVALID_CITY', 'City is not active or does not belong to an active province');
  }

  let uploaded: UploadedProfilePhoto | undefined;
  let oldPhotoUrl: string | null = null;
  try {
    if (file) uploaded = await uploadProfilePhoto({ userId, file });
    const details = await getDatabase().transaction(async (transaction) => {
      const lockedUser = await findActiveUserForUpdate(transaction, userId);
      if (!lockedUser) throw new UserNotFoundError();
      if (hasField(input, 'cityId') && requestedCityId !== null && requestedCityId !== undefined && !(await findActiveCityInTransaction(transaction, requestedCityId))) throw new InvalidCityError();
      const existing = await findUserDetailsByUserId(transaction, userId);
      oldPhotoUrl = existing?.profile_photo ?? null;
      const values: UserDetailsValues = {
        name: hasField(input, 'name') ? input.name as string : existing?.name ?? lockedUser.name,
        address: hasField(input, 'address') ? input.address ?? null : existing?.address ?? null,
        city_id: hasField(input, 'cityId') ? input.cityId ?? null : existing?.city_id ?? null,
        phone_number: hasField(input, 'phoneNumber') ? input.phoneNumber ?? null : existing?.phone_number ?? null,
        gender: hasField(input, 'gender') ? input.gender ?? null : existing?.gender ?? null,
        height: hasField(input, 'height') ? input.height ?? null : existing?.height ?? null,
        weight: hasField(input, 'weight') ? input.weight ?? null : existing?.weight ?? null,
        profile_photo: uploaded?.url ?? (hasField(input, 'profilePhoto') ? null : existing?.profile_photo ?? null),
      };
      const result = await upsertUserDetails(transaction, userId, values);
      if (hasField(input, 'name')) await updateUserName(transaction, userId, values.name);
      return result;
    });
    if (oldPhotoUrl && oldPhotoUrl !== details.profile_photo) await deleteManagedProfilePhotoByUrl({ userId, url: oldPhotoUrl });
    return details;
  } catch (error) {
    if (uploaded) {
      try {
        await deleteUploadedProfilePhoto(uploaded.key);
      } catch {
        // Preserve the original failure; cleanup is best effort.
      }
    }
    if (error instanceof UserNotFoundError) throw new AppError(401, 'UNAUTHORIZED', 'Authentication required');
    if (error instanceof InvalidCityError) throw new AppError(400, 'INVALID_CITY', 'City is not active or does not belong to an active province');
    if (error instanceof StorageUnavailableError) throw new AppError(503, 'STORAGE_UNAVAILABLE', 'Profile photo storage is unavailable');
    throw error;
  }
};
