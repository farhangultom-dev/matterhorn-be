import type { RequestHandler } from 'express';
import { deleteCurrentUser } from '../services/auth.service';
import { updateUserDetails } from '../services/user-details.service';
import type { ProfilePhotoFile } from '../services/profile-photo-storage.service';
import type { UpdateUserDetailsInput } from '../validations/user-details.validation';
import { successResponse } from '../views/response.view';
import { presentUserDetails } from '../views/user-details.view';

export const updateUserDetailsController: RequestHandler = async (request, response) => {
  const details = await updateUserDetails({
    userId: request.auth!.userId,
    input: response.locals.validatedBody as UpdateUserDetailsInput,
    file: response.locals.profilePhoto as ProfilePhotoFile | undefined,
  });
  response.json(successResponse('User details updated', { details: presentUserDetails(details) }));
};

export const deleteCurrentUserController: RequestHandler = async (request, response) => {
  await deleteCurrentUser(request.auth!.userId);
  response.json(successResponse('User deleted', { deleted: true }));
};
