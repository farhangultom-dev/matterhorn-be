import { loadEnvFile } from 'node:process';
import path from 'node:path';
import { z } from 'zod';

let envFileLoaded = false;

const loadEnvironmentFile = (): void => {
  if (envFileLoaded) return;
  envFileLoaded = true;
  try {
    loadEnvFile(path.resolve(__dirname, '../..', '.env'));
  } catch (error) {
    if (!(error instanceof Error && 'code' in error && error.code === 'ENOENT')) {
      throw error;
    }
  }
};

const optionalText = z.string().optional().default('');
const parseBoolean = z
  .enum(['true', 'false'])
  .transform((value) => value === 'true');
const positiveInt = z.string().regex(/^\d+$/).transform(Number);
const optionalBoolean = z.enum(['true', 'false']).optional().default('false').transform((value) => value === 'true');

const appSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: positiveInt.pipe(z.number().int().min(1).max(65535)).optional().transform((value) => value ?? 3000),
});

const databaseSchema = z.object({
  DB_HOST: z.string().min(1),
  DB_PORT: positiveInt.pipe(z.number().int().min(1).max(65535)),
  DB_NAME: z.string().min(1),
  DB_USER: z.string().min(1),
  DB_PASSWORD: z.string(),
});

const authSchema = z.object({
  JWT_SECRET: z.string().min(32),
  JWT_EXPIRES_IN_SECONDS: positiveInt.pipe(z.number().int().min(1).max(86400)),
  BCRYPT_SALT_ROUNDS: positiveInt.pipe(z.number().int().min(10).max(14)),
});

const bcryptSchema = z.object({
  BCRYPT_SALT_ROUNDS: positiveInt.pipe(z.number().int().min(10).max(14)),
});

const seedSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  SEED_DEMO_PASSWORD: z.string().min(8).refine((value) => Buffer.byteLength(value, 'utf8') <= 72, 'Must be at most 72 UTF-8 bytes'),
});

const smtpSchema = z
  .object({
    SMTP_ENABLED: parseBoolean,
    SMTP_HOST: optionalText,
    SMTP_PORT: positiveInt.pipe(z.number().int().min(1).max(65535)),
    SMTP_SECURE: parseBoolean,
    SMTP_USER: optionalText,
    SMTP_PASS: optionalText,
    SMTP_FROM: optionalText,
  })
  .superRefine((value, context) => {
    if (!value.SMTP_ENABLED) return;
    for (const field of ['SMTP_HOST', 'SMTP_USER', 'SMTP_PASS', 'SMTP_FROM'] as const) {
      if (!value[field]) context.addIssue({ code: 'custom', path: [field], message: 'Required when SMTP_ENABLED=true' });
    }
  });

const s3Schema = z
  .object({
    AWS_REGION: optionalText,
    S3_PROFILE_PHOTO_BUCKET: optionalText,
    PROFILE_PHOTO_PUBLIC_BASE_URL: optionalText,
    AWS_ACCESS_KEY_ID: optionalText,
    AWS_SECRET_ACCESS_KEY: optionalText,
    S3_ENDPOINT: optionalText,
    S3_FORCE_PATH_STYLE: optionalBoolean,
  })
  .superRefine((value, context) => {
    const configured = Boolean(value.AWS_REGION || value.S3_PROFILE_PHOTO_BUCKET || value.AWS_ACCESS_KEY_ID || value.AWS_SECRET_ACCESS_KEY || value.S3_ENDPOINT);
    if (!configured) return;
    for (const field of ['AWS_REGION', 'S3_PROFILE_PHOTO_BUCKET', 'PROFILE_PHOTO_PUBLIC_BASE_URL', 'AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY'] as const) {
      if (!value[field]) context.addIssue({ code: 'custom', path: [field], message: 'Required when S3 photo storage is configured' });
    }
    if (value.PROFILE_PHOTO_PUBLIC_BASE_URL) {
      try {
        const url = new URL(value.PROFILE_PHOTO_PUBLIC_BASE_URL);
        if (url.protocol !== 'https:') context.addIssue({ code: 'custom', path: ['PROFILE_PHOTO_PUBLIC_BASE_URL'], message: 'Must use HTTPS' });
        if (url.search || url.hash || url.username || url.password) context.addIssue({ code: 'custom', path: ['PROFILE_PHOTO_PUBLIC_BASE_URL'], message: 'Must not contain query, fragment, or credentials' });
        if (value.PROFILE_PHOTO_PUBLIC_BASE_URL.endsWith('/')) context.addIssue({ code: 'custom', path: ['PROFILE_PHOTO_PUBLIC_BASE_URL'], message: 'Must not end with a slash' });
      } catch {
        context.addIssue({ code: 'custom', path: ['PROFILE_PHOTO_PUBLIC_BASE_URL'], message: 'Must be a valid HTTPS URL' });
      }
    }
    if (value.S3_ENDPOINT) {
      try {
        const endpoint = new URL(value.S3_ENDPOINT);
        if (endpoint.protocol !== 'https:') context.addIssue({ code: 'custom', path: ['S3_ENDPOINT'], message: 'Must use HTTPS' });
        if (endpoint.search || endpoint.hash || endpoint.username || endpoint.password) context.addIssue({ code: 'custom', path: ['S3_ENDPOINT'], message: 'Must not contain query, fragment, or credentials' });
        if (value.S3_ENDPOINT.endsWith('/')) context.addIssue({ code: 'custom', path: ['S3_ENDPOINT'], message: 'Must not end with a slash' });
      } catch {
        context.addIssue({ code: 'custom', path: ['S3_ENDPOINT'], message: 'Must be a valid HTTPS URL' });
      }
    }
  });

const sumopodSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  SUMOPOD_BASE_URL: optionalText,
  SUMOPOD_ALLOW_SANDBOX_IN_PRODUCTION: optionalBoolean,
  SUMOPOD_API_KEY: optionalText,
  SUMOPOD_SUCCESS_RETURN_URL: optionalText,
  SUMOPOD_CANCEL_RETURN_URL: optionalText,
  SUMOPOD_WEBHOOK_TOKEN: optionalText,
}).superRefine((value, context) => {
  const configured = Boolean(value.SUMOPOD_BASE_URL || value.SUMOPOD_API_KEY || value.SUMOPOD_SUCCESS_RETURN_URL || value.SUMOPOD_CANCEL_RETURN_URL);
  if (!configured) return;
  for (const field of ['SUMOPOD_API_KEY', 'SUMOPOD_SUCCESS_RETURN_URL', 'SUMOPOD_CANCEL_RETURN_URL'] as const) {
    if (!value[field]) context.addIssue({ code: 'custom', path: [field], message: 'Required when SumoPod payments are configured' });
  }
  if (value.NODE_ENV === 'production' && !value.SUMOPOD_BASE_URL) {
    context.addIssue({ code: 'custom', path: ['SUMOPOD_BASE_URL'], message: 'Must be explicitly configured in production' });
  }
  const baseUrl = value.SUMOPOD_BASE_URL || 'https://api-pay-sandbox.sumopod.com/api/v1';
  try {
    const parsed = new URL(baseUrl);
    if (parsed.protocol !== 'https:' || parsed.username || parsed.password || parsed.search || parsed.hash) {
      context.addIssue({ code: 'custom', path: ['SUMOPOD_BASE_URL'], message: 'Must be an HTTPS URL without credentials, query, or fragment' });
    }
    if (value.NODE_ENV === 'production'
      && parsed.hostname === 'api-pay-sandbox.sumopod.com'
      && !value.SUMOPOD_ALLOW_SANDBOX_IN_PRODUCTION) {
      context.addIssue({
        code: 'custom',
        path: ['SUMOPOD_BASE_URL'],
        message: 'Production must not use the sandbox endpoint unless SUMOPOD_ALLOW_SANDBOX_IN_PRODUCTION=true',
      });
    }
  } catch {
    context.addIssue({ code: 'custom', path: ['SUMOPOD_BASE_URL'], message: 'Must be a valid HTTPS URL' });
  }
  for (const field of ['SUMOPOD_SUCCESS_RETURN_URL', 'SUMOPOD_CANCEL_RETURN_URL'] as const) {
    if (!value[field]) continue;
    try {
      const parsed = new URL(value[field]);
      if (parsed.protocol !== 'https:' || parsed.username || parsed.password) {
        context.addIssue({ code: 'custom', path: [field], message: 'Must be an HTTPS URL without credentials' });
      }
    } catch {
      context.addIssue({ code: 'custom', path: [field], message: 'Must be a valid HTTPS URL' });
    }
  }
});

const parse = <T>(schema: z.ZodType<T>): T => {
  loadEnvironmentFile();
  const result = schema.safeParse(process.env);
  if (!result.success) {
    const fields = result.error.issues.map((issue) => `${issue.path.join('.') || 'environment'}: ${issue.message}`);
    throw new Error(`Invalid environment configuration: ${fields.join('; ')}`);
  }
  return result.data;
};

export interface AppEnv {
  readonly nodeEnv: 'development' | 'test' | 'production';
  readonly port: number;
}

export interface DatabaseEnv {
  readonly host: string;
  readonly port: number;
  readonly database: string;
  readonly user: string;
  readonly password: string;
}

export interface AuthEnv {
  readonly jwtSecret: string;
  readonly jwtExpiresInSeconds: number;
  readonly bcryptSaltRounds: number;
}

export interface SmtpEnv {
  readonly enabled: boolean;
  readonly host: string;
  readonly port: number;
  readonly secure: boolean;
  readonly user: string;
  readonly pass: string;
  readonly from: string;
}

export interface SeedEnv {
  readonly nodeEnv: 'development' | 'test' | 'production';
  readonly demoPassword: string;
}

export interface S3Env {
  readonly configured: boolean;
  readonly region: string;
  readonly bucket: string;
  readonly publicBaseUrl: string;
  readonly credentials: {
    readonly accessKeyId: string;
    readonly secretAccessKey: string;
  };
  readonly endpoint?: string;
  readonly forcePathStyle: boolean;
}

export interface SumopodEnv {
  readonly configured: boolean;
  readonly baseUrl: string;
  readonly apiKey: string;
  readonly successReturnUrl: string;
  readonly cancelReturnUrl: string;
}

export interface SumopodWebhookEnv {
  readonly configured: boolean;
  readonly token: string;
}

export const getAppEnv = (): AppEnv => {
  const value = parse(appSchema);
  return { nodeEnv: value.NODE_ENV, port: value.PORT };
};

export const getDatabaseEnv = (): DatabaseEnv => {
  const value = parse(databaseSchema);
  return { host: value.DB_HOST, port: value.DB_PORT, database: value.DB_NAME, user: value.DB_USER, password: value.DB_PASSWORD };
};

export const getAuthEnv = (): AuthEnv => {
  const value = parse(authSchema);
  return { jwtSecret: value.JWT_SECRET, jwtExpiresInSeconds: value.JWT_EXPIRES_IN_SECONDS, bcryptSaltRounds: value.BCRYPT_SALT_ROUNDS };
};

export const getBcryptSaltRounds = (): number => parse(bcryptSchema).BCRYPT_SALT_ROUNDS;

export const getSmtpEnv = (): SmtpEnv => {
  const value = parse(smtpSchema);
  return { enabled: value.SMTP_ENABLED, host: value.SMTP_HOST, port: value.SMTP_PORT, secure: value.SMTP_SECURE, user: value.SMTP_USER, pass: value.SMTP_PASS, from: value.SMTP_FROM };
};

export const getSeedEnv = (): SeedEnv => {
  const value = parse(seedSchema);
  return { nodeEnv: value.NODE_ENV, demoPassword: value.SEED_DEMO_PASSWORD };
};

export const getS3Env = (): S3Env => {
  const value = parse(s3Schema);
  return {
    configured: Boolean(value.AWS_REGION && value.S3_PROFILE_PHOTO_BUCKET && value.PROFILE_PHOTO_PUBLIC_BASE_URL && value.AWS_ACCESS_KEY_ID && value.AWS_SECRET_ACCESS_KEY),
    region: value.AWS_REGION,
    bucket: value.S3_PROFILE_PHOTO_BUCKET,
    publicBaseUrl: value.PROFILE_PHOTO_PUBLIC_BASE_URL,
    credentials: { accessKeyId: value.AWS_ACCESS_KEY_ID, secretAccessKey: value.AWS_SECRET_ACCESS_KEY },
    endpoint: value.S3_ENDPOINT || undefined,
    forcePathStyle: value.S3_FORCE_PATH_STYLE,
  };
};

export const getSumopodEnv = (): SumopodEnv => {
  const value = parse(sumopodSchema);
  const baseUrl = (value.SUMOPOD_BASE_URL || 'https://api-pay-sandbox.sumopod.com/api/v1').replace(/\/+$/, '');
  return {
    configured: Boolean(value.SUMOPOD_API_KEY && value.SUMOPOD_SUCCESS_RETURN_URL && value.SUMOPOD_CANCEL_RETURN_URL),
    baseUrl,
    apiKey: value.SUMOPOD_API_KEY,
    successReturnUrl: value.SUMOPOD_SUCCESS_RETURN_URL,
    cancelReturnUrl: value.SUMOPOD_CANCEL_RETURN_URL,
  };
};

export const getSumopodWebhookEnv = (): SumopodWebhookEnv => {
  const value = parse(sumopodSchema);
  const token = value.SUMOPOD_WEBHOOK_TOKEN.trim();
  return { configured: token.length > 0, token };
};
