import type { RequestHandler } from 'express';
import { getCurrentUser, login, register, resendVerificationOtp, verifyEmail } from '../services/auth.service';
import type { LoginInput, RegisterInput, ResendVerificationOtpInput, VerifyEmailInput } from '../validations/auth.validation';
import { presentUser } from '../views/user.view';
import { presentUserDetails } from '../views/user-details.view';
import { successResponse } from '../views/response.view';
import { presentUserRoleWithName } from '../views/user-role.view';

export const registerController: RequestHandler = async (_request, response) => {
  const user = await register(response.locals.validatedBody as RegisterInput);
  response.status(201).json(successResponse('Registration successful. Check your email for the verification code', { user: presentUser(user) }));
};

export const loginController: RequestHandler = async (_request, response) => {
  const result = await login(response.locals.validatedBody as LoginInput);
  response.json(successResponse('Login successful', {
    user: presentUser(result.user),
    userRoles: result.userRoles.map(presentUserRoleWithName),
    accessToken: result.accessToken,
    tokenType: 'Bearer',
    expiresIn: result.expiresIn,
  }));
};

export const meController: RequestHandler = async (request, response) => {
  const result = await getCurrentUser(request.auth!.userId);
  response.json(successResponse('Profile retrieved', {
    user: presentUser(result.user, result.userDetails?.city_name ?? null, result.userDetails?.province_name ?? null),
    userDetails: result.userDetails ? presentUserDetails(result.userDetails) : null,
    userDisciplineSports: result.userDisciplineSports.map((sport) => ({
      id: sport.id,
      disciplineSportId: sport.discipline_sport_id,
      disciplineSportName: sport.discipline_sport_name,
      cityName: sport.city_name,
      provinceName: sport.province_name,
    })),
  }));
};

export const verifyEmailController: RequestHandler = async (_request, response) => {
  await verifyEmail(response.locals.validatedBody as VerifyEmailInput);
  response.json(successResponse('Email verified', { isEmailVerified: true }));
};

export const resendVerificationOtpController: RequestHandler = async (_request, response) => {
  await resendVerificationOtp(response.locals.validatedBody as ResendVerificationOtpInput);
  response.json(successResponse('If verification is needed, a code will be sent', {}));
};
