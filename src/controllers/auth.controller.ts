import type { RequestHandler } from 'express';
import { getCurrentUser, login, register, resendVerificationOtp, verifyEmail } from '../services/auth.service';
import type { LoginInput, RegisterInput, ResendVerificationOtpInput, VerifyEmailInput } from '../validations/auth.validation';
import { presentUser } from '../views/user.view';
import { presentUserDetails } from '../views/user-details.view';
import { successResponse } from '../views/response.view';

export const registerController: RequestHandler = async (_request, response) => {
  const user = await register(response.locals.validatedBody as RegisterInput);
  response.status(201).json(successResponse('Registration successful. Check your email for the verification code', { user: presentUser(user) }));
};

export const loginController: RequestHandler = async (_request, response) => {
  const result = await login(response.locals.validatedBody as LoginInput);
  response.json(successResponse('Login successful', { user: presentUser(result.user), accessToken: result.accessToken, tokenType: 'Bearer', expiresIn: result.expiresIn }));
};

export const meController: RequestHandler = async (request, response) => {
  const result = await getCurrentUser(request.auth!.userId);
  response.json(successResponse('Profile retrieved', {
    user: presentUser(result.user),
    userDetails: result.userDetails ? presentUserDetails(result.userDetails) : null,
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
