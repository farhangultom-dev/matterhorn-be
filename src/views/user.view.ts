import type { UserRecord } from '../models/user.model';

export interface PublicUser {
  readonly id: string;
  readonly name: string;
  readonly email: string;
  readonly isEmailVerified: boolean;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export const presentUser = (user: UserRecord): PublicUser => ({
  id: user.id,
  name: user.name,
  email: user.email,
  isEmailVerified: user.is_email_verified,
  createdAt: new Date(user.created_at).toISOString(),
  updatedAt: new Date(user.updated_at).toISOString(),
});
