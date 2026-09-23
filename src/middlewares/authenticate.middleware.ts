import type { RequestHandler } from 'express';
import { getAuthEnv } from '../config/env';
import { verifyAccessToken } from '../utils/jwt';
import { AppError } from '../utils/app-error';
import { findUserById } from '../models/user.model';

export const authenticate: RequestHandler = async (request, _response, next) => {
  const header = request.header('authorization');
  const match = header?.match(/^Bearer\s+([^\s]+)$/i);
  if (!match) {
    next(new AppError(401, 'UNAUTHORIZED', 'Authentication required'));
    return;
  }
  try {
    const userId = verifyAccessToken(match[1], getAuthEnv().jwtSecret);
    const user = await findUserById(userId);
    if (!user) {
      next(new AppError(401, 'UNAUTHORIZED', 'Authentication required'));
      return;
    }
    if (!user.is_email_verified) {
      next(new AppError(403, 'EMAIL_NOT_VERIFIED', 'Email address must be verified'));
      return;
    }
    request.auth = { userId };
    next();
  } catch (error) {
    if (error instanceof AppError) {
      next(error);
      return;
    }
    next(new AppError(401, 'UNAUTHORIZED', 'Authentication required'));
  }
};
