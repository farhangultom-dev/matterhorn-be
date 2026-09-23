import type { Knex } from 'knex';
import { z } from 'zod';
import { indonesiaGeographySourceUrl, referenceRoleNames, referenceSportNames } from './seed-data';

interface IdNameRow {
  readonly id: number;
  readonly name: string;
}

interface CityIdNameRow {
  readonly id: number;
  readonly province_id: number;
  readonly name: string;
}

interface IndonesiaGeography {
  readonly provinsi: Readonly<Record<string, string>>;
  readonly kabupaten: Readonly<Record<string, Readonly<Record<string, string>>>>;
}

interface ProvinceSeedRow {
  readonly code: string;
  readonly name: string;
}

interface CitySeedRow {
  readonly provinceCode: string;
  readonly name: string;
}

interface StarterCityRename {
  readonly provinceName: string;
  readonly oldName: string;
  readonly newName: string;
}

const indonesiaGeographySchema = z.object({
  provinsi: z.record(z.string(), z.string().min(1).max(100)),
  kabupaten: z.record(z.string(), z.record(z.string(), z.string().min(1).max(100))),
});

const starterProvinceRenames = [
  { oldName: 'DKI Jakarta', newName: 'DKI JAKARTA' },
  { oldName: 'Jawa Barat', newName: 'JAWA BARAT' },
  { oldName: 'Banten', newName: 'BANTEN' },
] as const;

const starterCityRenames: readonly StarterCityRename[] = [
  { provinceName: 'DKI JAKARTA', oldName: 'Jakarta Selatan', newName: 'JAKARTA SELATAN' },
  { provinceName: 'DKI JAKARTA', oldName: 'Jakarta Pusat', newName: 'JAKARTA PUSAT' },
  { provinceName: 'JAWA BARAT', oldName: 'Bandung', newName: 'KOTA BANDUNG' },
  { provinceName: 'BANTEN', oldName: 'Tangerang Selatan', newName: 'KOTA TANGERANG SELATAN' },
];

const fetchIndonesiaGeography = async (): Promise<IndonesiaGeography> => {
  const response = await fetch(indonesiaGeographySourceUrl, {
    headers: { accept: 'application/json' },
    signal: AbortSignal.timeout(30_000),
  });

  if (!response.ok) {
    throw new Error(`Unable to download Indonesian geography data: HTTP ${response.status}.`);
  }

  return indonesiaGeographySchema.parse(await response.json());
};

const buildGeographyRows = (geography: IndonesiaGeography): { readonly provinces: readonly ProvinceSeedRow[]; readonly cities: readonly CitySeedRow[] } => {
  const provinces = Object.entries(geography.provinsi).map(([code, name]) => ({ code, name }));
  const cities = Object.entries(geography.kabupaten).flatMap(([provinceCode, citiesByCode]) =>
    Object.values(citiesByCode).map((name) => ({ provinceCode, name })),
  );

  if (provinces.length !== 38 || cities.length !== 514) {
    throw new Error(`Unexpected Indonesian geography dataset size: expected 38 provinces and 514 regencies/cities, received ${provinces.length} and ${cities.length}.`);
  }

  return { provinces, cities };
};

const renameStarterReferenceRows = async (transaction: Knex.Transaction): Promise<void> => {
  for (const rename of starterProvinceRenames) {
    const oldRow = await transaction<IdNameRow>('provinces').select('id').where({ name: rename.oldName }).first();
    const newRow = await transaction<IdNameRow>('provinces').select('id').where({ name: rename.newName }).first();
    if (oldRow && !newRow) await transaction('provinces').where({ id: oldRow.id }).update({ name: rename.newName });
  }

  for (const rename of starterCityRenames) {
    const province = await transaction<IdNameRow>('provinces').select('id').where({ name: rename.provinceName }).first();
    if (!province) continue;

    const oldRow = await transaction<CityIdNameRow>('cities').select('id').where({ province_id: province.id, name: rename.oldName }).first();
    const newRow = await transaction<CityIdNameRow>('cities').select('id').where({ province_id: province.id, name: rename.newName }).first();
    if (oldRow && !newRow) await transaction('cities').where({ id: oldRow.id }).update({ name: rename.newName });
  }
};

const getProvinceIdsByCode = async (
  transaction: Knex.Transaction,
  provinces: readonly ProvinceSeedRow[],
): Promise<Map<string, number>> => {
  const names = provinces.map((province) => province.name);
  const rows = await transaction<IdNameRow>('provinces').select('id', 'name').whereIn('name', names);
  const idsByName = new Map(rows.map((row) => [row.name, row.id]));
  return new Map(
    provinces.map((province) => {
      const id = idsByName.get(province.name);
      if (id === undefined) throw new Error(`Missing seeded province: ${province.name}`);
      return [province.code, id];
    }),
  );
};

export async function seed(knex: Knex): Promise<void> {
  const geography = buildGeographyRows(await fetchIndonesiaGeography());

  await knex.transaction(async (transaction) => {
    await renameStarterReferenceRows(transaction);
    await transaction('roles').insert(referenceRoleNames.map((name) => ({ name }))).onConflict('name').merge(['name']);
    await transaction('provinces').insert(geography.provinces.map((province) => ({ name: province.name }))).onConflict('name').merge(['name']);
    await transaction('discipline_sports').insert(referenceSportNames.map((name) => ({ name }))).onConflict('name').merge(['name']);

    const provinceIds = await getProvinceIdsByCode(transaction, geography.provinces);
    const cityRows = geography.cities.map((city) => {
      const provinceId = provinceIds.get(city.provinceCode);
      if (provinceId === undefined) throw new Error(`Missing seeded province code: ${city.provinceCode}`);
      return { province_id: provinceId, name: city.name };
    });
    await transaction('cities').insert(cityRows).onConflict(['province_id', 'name']).merge(['name']);
  });

  console.log('Reference seed: roles, 38 Indonesian provinces, 514 Indonesian regencies/cities, and discipline sports are ready');
}
