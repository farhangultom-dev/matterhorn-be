import { z } from 'zod';

const maxPasswordBytes = (value: string): boolean => Buffer.byteLength(value, 'utf8') <= 72;

export const registerSchema = z.object({
  name: z.string().trim().min(1).max(100),
  email: z.string().trim().toLowerCase().email().max(254),
  password: z.string().min(8).refine(maxPasswordBytes, 'Password must be at most 72 UTF-8 bytes'),
}).strict();

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  password: z.string().min(1).refine(maxPasswordBytes, 'Password must be at most 72 UTF-8 bytes'),
}).strict();

export const verifyEmailSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  otp: z.string().regex(/^\d{6}$/, 'OTP must be exactly 6 digits'),
}).strict();

export const resendVerificationOtpSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
}).strict();

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type VerifyEmailInput = z.infer<typeof verifyEmailSchema>;
export type ResendVerificationOtpInput = z.infer<typeof resendVerificationOtpSchema>;
