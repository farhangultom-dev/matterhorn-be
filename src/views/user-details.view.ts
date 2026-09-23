interface UserDetailsViewRecord {
  readonly id: number;
  readonly user_id: string;
  readonly name: string;
  readonly address: string | null;
  readonly city_id: number | null;
  readonly phone_number: string | null;
  readonly gender: string | null;
  readonly height: number | null;
  readonly weight: number | null;
  readonly profile_photo: string | null;
  readonly created_at: Date;
}

export interface PublicUserDetails {
  readonly id: number;
  readonly userId: string;
  readonly name: string;
  readonly address: string | null;
  readonly cityId: number | null;
  readonly phoneNumber: string | null;
  readonly gender: string | null;
  readonly height: number | null;
  readonly weight: number | null;
  readonly profilePhoto: string | null;
  readonly createdAt: Date;
}

export const presentUserDetails = (details: UserDetailsViewRecord): PublicUserDetails => ({
  id: details.id,
  userId: details.user_id,
  name: details.name,
  address: details.address,
  cityId: details.city_id,
  phoneNumber: details.phone_number,
  gender: details.gender,
  height: details.height,
  weight: details.weight,
  profilePhoto: details.profile_photo,
  createdAt: details.created_at,
});
