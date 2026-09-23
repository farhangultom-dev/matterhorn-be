import { randomUUID } from 'node:crypto';
import { getDatabase } from '../config/database';
import { getAuthEnv, getSmtpEnv } from '../config/env';
import { createRegisteredUser, findUserByEmail, findUserByEmailForUpdate, findUserById, isMissingRoleError, isUniqueEmailError, markUserEmailVerified, softDeleteUser, type UserRecord } from '../models/user.model';
import { deleteEmailVerificationOtp, findEmailVerificationOtpForUpdate, getDatabaseNow, insertEmailVerificationOtp, updateEmailVerificationOtp } from '../models/email-verification-otp.model';
import type { LoginInput, RegisterInput, ResendVerificationOtpInput, VerifyEmailInput } from '../validations/auth.validation';
import { AppError } from '../utils/app-error';
import { comparePassword, dummyPasswordHash, hashPassword } from '../utils/password';
import { createAccessToken } from '../utils/jwt';
import { findActiveUserDetailsByUserId, type UserDetailsRecord } from '../models/user-details.model';
import { generateEmailOtp, EMAIL_OTP_MAX_FAILED_ATTEMPTS, EMAIL_OTP_MAX_RESENDS, EMAIL_OTP_RESEND_DELAY_MS, EMAIL_OTP_WINDOW_MS, matchesEmailOtp } from '../utils/email-otp';
import { sendVerificationEmail } from './mail.service';

const emailDeliveryUnavailable = (): AppError => new AppError(503, 'EMAIL_DELIVERY_UNAVAILABLE', 'Email delivery is unavailable');
const REGISTER_DEFAULT_ROLE_ID = 5;

const requireEmailDelivery = (): void => {
  try {
    if (!getSmtpEnv().enabled) throw emailDeliveryUnavailable();
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw emailDeliveryUnavailable();
  }
};

export const register = async (input: RegisterInput): Promise<UserRecord> => {
  requireEmailDelivery();
  const env = getAuthEnv();
  const userId = randomUUID().replaceAll('-', '');
  const now = await getDatabaseNow(getDatabase());
  const otp = generateEmailOtp({ userId, secret: env.jwtSecret, now });
  const passwordHash = await hashPassword(input.password, env.bcryptSaltRounds);
  try {
    const user = await createRegisteredUser({
      id: userId,
      name: input.name,
      email: input.email,
      password_hash: passwordHash,
      is_email_verified: false,
      roleId: REGISTER_DEFAULT_ROLE_ID,
      verificationOtp: {
        code_hash: otp.codeHash,
        expires_at: otp.expiresAt,
        sent_at: now,
        send_window_started_at: now,
        send_count: 1,
      },
    });
    try {
      await sendVerificationEmail({ to: user.email, otp: otp.code });
    } catch {
      throw emailDeliveryUnavailable();
    }
    return user;
  } catch (error) {
    if (isUniqueEmailError(error)) throw new AppError(409, 'EMAIL_ALREADY_EXISTS', 'Email is already registered');
    if (isMissingRoleError(error)) throw new AppError(500, 'AUTH_REFERENCE_DATA_MISSING', 'Registration role ID 5 is unavailable. Add the role before accepting registrations.');
    throw error;
  }
};

export interface LoginResult {
  readonly user: UserRecord;
  readonly accessToken: string;
  readonly expiresIn: number;
}

export const login = async (input: LoginInput): Promise<LoginResult> => {
  const env = getAuthEnv();
  const user = await findUserByEmail(input.email);
  const passwordMatches = await comparePassword(input.password, user?.password_hash ?? dummyPasswordHash);
  if (!user || !passwordMatches) throw new AppError(401, 'INVALID_CREDENTIALS', 'Email or password is incorrect');
  if (!user.is_email_verified) throw new AppError(403, 'EMAIL_NOT_VERIFIED', 'Email address must be verified');
  return { user, accessToken: createAccessToken(user.id, env.jwtSecret, env.jwtExpiresInSeconds), expiresIn: env.jwtExpiresInSeconds };
};

export interface CurrentUserResult {
  readonly user: UserRecord;
  readonly userDetails: UserDetailsRecord | null;
}

export const getCurrentUser = async (userId: string): Promise<CurrentUserResult> => {
  const user = await findUserById(userId);
  if (!user) throw new AppError(401, 'UNAUTHORIZED', 'Authentication required');
  const details = await findActiveUserDetailsByUserId(userId);
  return { user, userDetails: details ?? null };
};

export const deleteCurrentUser = async (userId: string): Promise<void> => {
  const deleted = await softDeleteUser(userId);
  if (!deleted) throw new AppError(401, 'UNAUTHORIZED', 'Authentication required');
};

export const verifyEmail = async (input: VerifyEmailInput): Promise<void> => {
  const result = await getDatabase().transaction(async (transaction) => {
    const user = await findUserByEmailForUpdate(transaction, input.email);
    if (!user) return 'invalid' as const;
    if (user.is_email_verified) return 'already-verified' as const;
    const otp = await findEmailVerificationOtpForUpdate(transaction, user.id);
    const now = await getDatabaseNow(transaction);
    if (!otp || otp.expires_at <= now || otp.failed_attempts >= EMAIL_OTP_MAX_FAILED_ATTEMPTS) return 'invalid' as const;
    if (!matchesEmailOtp({ userId: user.id, code: input.otp, codeHash: otp.code_hash, secret: getAuthEnv().jwtSecret })) {
      await updateEmailVerificationOtp(transaction, user.id, { failed_attempts: otp.failed_attempts + 1 });
      return 'invalid' as const;
    }
    await markUserEmailVerified(transaction, user.id);
    await deleteEmailVerificationOtp(transaction, user.id);
    return 'verified' as const;
  });
  if (result === 'already-verified') throw new AppError(409, 'EMAIL_ALREADY_VERIFIED', 'Email is already verified');
  if (result !== 'verified') throw new AppError(400, 'INVALID_OR_EXPIRED_OTP', 'The verification code is invalid or expired');
};

export const resendVerificationOtp = async (input: ResendVerificationOtpInput): Promise<void> => {
  const existingUser = await findUserByEmail(input.email);
  if (!existingUser || existingUser.is_email_verified) return;
  requireEmailDelivery();
  const env = getAuthEnv();
  const result = await getDatabase().transaction(async (transaction) => {
    const user = await findUserByEmailForUpdate(transaction, input.email);
    if (!user || user.is_email_verified) return { kind: 'generic' as const };
    const now = await getDatabaseNow(transaction);
    const currentOtp = await findEmailVerificationOtpForUpdate(transaction, user.id);
    if (currentOtp && now.getTime() - new Date(currentOtp.sent_at).getTime() < EMAIL_OTP_RESEND_DELAY_MS) {
      return { kind: 'limited' as const };
    }
    const windowIsExpired = !currentOtp || now.getTime() - new Date(currentOtp.send_window_started_at).getTime() >= EMAIL_OTP_WINDOW_MS;
    if (currentOtp && !windowIsExpired && currentOtp.send_count >= EMAIL_OTP_MAX_RESENDS) {
      return { kind: 'limited' as const };
    }
    const nextOtp = generateEmailOtp({ userId: user.id, secret: env.jwtSecret, now });
    const sendCount = windowIsExpired ? 1 : (currentOtp?.send_count ?? 0) + 1;
    const windowStartedAt = windowIsExpired ? now : currentOtp?.send_window_started_at ?? now;
    const values = {
      code_hash: nextOtp.codeHash,
      expires_at: nextOtp.expiresAt,
      sent_at: now,
      failed_attempts: 0,
      send_window_started_at: windowStartedAt,
      send_count: sendCount,
    };
    if (currentOtp) await updateEmailVerificationOtp(transaction, user.id, values);
    else await insertEmailVerificationOtp(transaction, { user_id: user.id, ...values });
    return { kind: 'sent' as const, email: user.email, otp: nextOtp.code };
  });
  if (result.kind === 'limited') throw new AppError(429, 'OTP_RESEND_LIMITED', 'Please wait before requesting another code');
  if (result.kind === 'sent') {
    try {
      await sendVerificationEmail({ to: result.email, otp: result.otp });
    } catch {
      throw emailDeliveryUnavailable();
    }
  }
};
