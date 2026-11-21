import { describe, expect, it } from 'vitest';
import { getRecommendations } from '../src/server/platform/launchPlatform';

function candidate(id: string, patch: Record<string, unknown> = {}) {
  return {
    id,
    data: () => ({
      name: id, age: 30, location: 'München', bio: '', interests: ['Wandern'],
      isAdult: true, active: true, isSuspended: false, isBlocked: false, isVerified: true, lastActiveAt: new Date(),
      ...patch,
    }),
  };
}
function fakeDb(records: Array<ReturnType<typeof candidate>>, deleted: string[] = []) {
  const ownerState = new Map(records.map(record => [record.id, record.data()]));
  const db = {
    collection: (name: string) => {
      if (name === 'public_profiles') return { where: () => ({ limit: () => ({ get: async () => ({ docs: records }) }) }) };
      if (name === 'users') return { doc: (id: string) => ({
        get: async () => ({ exists: ownerState.has(id), data: () => ownerState.get(id) }),
      }) };
      if (name === 'account_deletions') return { doc: (id: string) => ({ get: async () => ({ exists: deleted.includes(id) }) }) };
      return { where: () => ({ limit: () => ({ get: async () => ({ docs: [], size: 0, forEach: () => undefined }) }) }) };
    },
  };
  return db as any;
}
describe('recommendation candidate adult and lifecycle gate', () => {
  it('serializes only adult, active, non-suspended and non-deletion-pending candidates', async () => {
    const fixtures = [
      candidate('adult'),
      candidate('minor', { isAdult: false }),
      candidate('suspended', { isSuspended: true }),
      candidate('blocked', { isBlocked: true }),
      candidate('inactive', { active: false }),
      candidate('deleting'),
      candidate('deletion-flag-pending', { deletionPending: true }),
      candidate('deletion-flag-corrupt', { deletionPending: null }),
    ];
    const db = fakeDb(fixtures, ['deleting']);
    (db as any).collection = (name: string) => {
      if (name === 'public_profiles') return { where: () => ({ limit: () => ({ get: async () => ({ docs: fixtures }) }) }) };
      if (name === 'users') return { doc: (id: string) => ({
        get: async () => {
          const record = fixtures.find(item => item.id === id);
          return { exists: !!record, data: () => record?.data() };
        },
      }) };
      if (name === 'account_deletions') return { doc: (id: string) => ({ get: async () => ({ exists: id === 'deleting' }) }) };
      return { where: () => ({ limit: () => ({ get: async () => ({ docs: [], size: 0, forEach: () => undefined }) }) }) };
    };
    const result = await getRecommendations(db, 'viewer', { location: 'München', interests: ['Wandern'], limit: 12 } as any);
    expect(result.map(item => item.id)).toEqual(['adult']);
  });
});
