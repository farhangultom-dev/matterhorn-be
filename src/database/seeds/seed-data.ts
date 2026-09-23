export const referenceRoleNames = ['admin', 'member', 'community_owner', 'organizer', 'common_user'] as const;
export const referenceSportNames = ['Kickboxing', 'Wrestling', 'MMA', 'Sambo', 'BJJ'] as const;

/**
 * Pinned source containing 38 provinces and 514 regencies/cities. The source
 * revision is fixed so repeated seeds use the same geography dataset.
 */
export const indonesiaGeographySourceUrl =
  'https://gist.githubusercontent.com/codenoid/a2f06c0f23fdb99e2a8a247ecfc59c16/raw/8f9f38640151f38b33c57ef943497f83819970b8/wilayah.json';

export const developmentIds = {
  adminUser: '10000000000040008000000000000001',
  commonUser: '10000000000040008000000000000002',
  community: '20000000000040008000000000000001',
  organizer: '30000000000040008000000000000001',
  event: '40000000000040008000000000000001',
  eventSport: '50000000000040008000000000000001',
  participant: '60000000000040008000000000000001',
  freeTicket: '70000000000040008000000000000001',
  regularTicket: '70000000000040008000000000000002',
  order: '80000000000040008000000000000001',
  orderItem: '90000000000040008000000000000001',
} as const;

export const developmentValues = {
  adminEmail: 'admin@matterhorn.test',
  commonUserEmail: 'member@matterhorn.test',
  communitySlug: 'matterhorn-fight-club',
  eventSlug: 'matterhorn-fight-club-tournament-2027',
  communityName: 'Matterhorn Fight Club',
  organizerName: 'Matterhorn Fight Club Organizer',
  eventTitle: 'Matterhorn MMA Tournament',
  communityLocationUrl: 'https://example.test/maps/matterhorn-fight-club',
  merchantReference: 'demo-matterhorn-order-0001',
} as const;
