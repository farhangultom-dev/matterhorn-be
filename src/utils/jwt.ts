import jwt from 'jsonwebtoken';
import { z } from 'zod';

const payloadSchema = z.object({ sub: z.string().uuid() });

export const createAccessToken = (userId: string, secret: string, expiresInSeconds: number): string => jwt.sign({ sub: userId }, secret, { algorithm: 'HS256', expiresIn: expiresInSeconds });

export const verifyAccessToken = (token: string, secret: string): string => {
  const payload = jwt.verify(token, secret, { algorithms: ['HS256'] });
  const parsed = payloadSchema.safeParse(payload);
  if (!parsed.success) throw new Error('Invalid token payload');
  return parsed.data.sub;
};
