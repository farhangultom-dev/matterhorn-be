import { createHmac, randomInt, timingSafeEqual } from 'node:crypto';

export const EMAIL_OTP_TTL_MS = 10 * 60 * 1000;
export const EMAIL_OTP_RESEND_DELAY_MS = 60 * 1000;
export const EMAIL_OTP_WINDOW_MS = 60 * 60 * 1000;
export const EMAIL_OTP_MAX_RESENDS = 5;
export const EMAIL_OTP_MAX_FAILED_ATTEMPTS = 5;

export interface GeneratedEmailOtp {
  readonly code: string;
  readonly codeHash: string;
  readonly expiresAt: Date;
}

const createOtpHash = (userId: string, code: string, secret: string): Buffer =>
  createHmac('sha256', secret).update('matterhorn-email-verification:' + userId + ':' + code).digest();

export const generateEmailOtp = ({ userId, secret, now }: { userId: string; secret: string; now: Date }): GeneratedEmailOtp => {
  const code = randomInt(0, 1_000_000).toString().padStart(6, '0');
  return {
    code,
    codeHash: createOtpHash(userId, code, secret).toString('hex'),
    expiresAt: new Date(now.getTime() + EMAIL_OTP_TTL_MS),
  };
};

export const matchesEmailOtp = ({ userId, code, codeHash, secret }: { userId: string; code: string; codeHash: string; secret: string }): boolean => {
  const expected = Buffer.from(codeHash, 'hex');
  const actual = createOtpHash(userId, code, secret);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
};
