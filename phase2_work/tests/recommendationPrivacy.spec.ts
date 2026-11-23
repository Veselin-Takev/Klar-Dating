// @vitest-environment node
import { afterEach, describe, expect, it } from 'vitest';
import { getDb } from '../src/server/db';
import { getRecommendations, scanRecommendationPages, toPublicProfile } from '../src/server/platform/launchPlatform';
import { compatibilityScore } from '../src/server/platform/compatibility';
const ids: string[] = [];
const blockIds: string[] = [];
const deletionIds: string[] = [];
afterEach(async () => {
  for (const id of blockIds.splice(0)) await getDb().collection('blocks').doc(id).delete();
  for (const id of deletionIds.splice(0)) await getDb().collection('account_deletions').doc(id).delete();
  for (const id of ids.splice(0)) {
    await Promise.all([
      getDb().collection('public_profiles').doc(id).delete(),
      getDb().collection('users').doc(id).delete(),
    ]);
  }
});
const music = { genres: ['Jazz'], concertGoer: true, playingInstrument: true };
describe('published preferences and recommendation privacy', () => {
  it('excludes blocks beyond the first page in both directions', async () => {
    const viewer = `blocked-viewer-${crypto.randomUUID()}`;
    const candidate = `blocked-candidate-${crypto.randomUUID()}`; ids.push(candidate);
    await Promise.all([
      getDb().collection('public_profiles').doc(candidate).set({ name: 'Blocked', age: 28, location: 'Berlin', isAdult: true, isVerified: true, active: true, lastActiveAt: new Date() }),
      getDb().collection('users').doc(candidate).set({ isAdult: true, active: true, isSuspended: false, isBlocked: false }),
    ]);
    for (const reverse of [false, true]) {
      const batch = getDb().batch();
      for (let index = 0; index < 202; index++) {
        const id = `${viewer}-${reverse}-${String(index).padStart(3, '0')}`; blockIds.push(id);
        const other = index === 201 ? candidate : `unrelated-${index}`;
        batch.set(getDb().collection('blocks').doc(id), reverse ? { blockerUid: other, blockedUid: viewer } : { blockerUid: viewer, blockedUid: other });
      }
      await batch.commit();
      const recommendations = await getRecommendations(getDb(), viewer, { location: 'Berlin' });
      expect(recommendations.some(row => row.id === candidate)).toBe(false);
      const cleanup = getDb().batch(); for (const id of blockIds.splice(0)) cleanup.delete(getDb().collection('blocks').doc(id)); await cleanup.commit();
    }
  }, 30_000); // Emulator integration: >400 writes, two paginated queries and cleanup.

  it('retains valid music preferences in the safe public projection', () => {
    const ownerState = { isAdult: true, active: true, isSuspended: false, isBlocked: false };
    const profile = toPublicProfile('a', {
      name: 'Anna', age: 28, location: 'Berlin', isAdult: true, active: true,
      musicPreferences: music, email: 'private@example.test',
    }, { accountState: ownerState, deletionBarrierExists: false });
    expect(profile?.musicPreferences).toEqual(music); expect(profile).not.toHaveProperty('email');
  });
  it('uses the requested 30 percent music weighting in the active server algorithm', () => {
    expect(compatibilityScore({ interests: ['Musik'], musicPreferences: music }, { interests: ['Musik'], musicPreferences: music })).toBe(100);
    expect(compatibilityScore({ interests: ['Musik'], musicPreferences: music }, { interests: ['Musik'], musicPreferences: { genres: ['Rock'], concertGoer: false, playingInstrument: false } })).toBe(70);
  });
  it('does not return legacy private fields from an existing public document', async () => {
    const id = `privacy-${crypto.randomUUID()}`; ids.push(id);
    await Promise.all([
      getDb().collection('public_profiles').doc(id).set({ name: 'Test', age: 28, location: 'Berlin', isAdult: true, isVerified: true, active: true, lastActiveAt: new Date(), musicPreferences: music, email: 'private@example.test', einwilligung: { evidenceId: 'private' }, role: 'admin' }),
      getDb().collection('users').doc(id).set({ isAdult: true, active: true, isSuspended: false, isBlocked: false }),
    ]);
    const rows = await getRecommendations(getDb(), 'viewer', { location: 'Berlin', musicPreferences: music });
    const profile = rows.find(row => row.id === id)?.profile;
    expect(profile).toBeDefined(); expect(profile).not.toHaveProperty('email'); expect(profile).not.toHaveProperty('einwilligung'); expect(profile).not.toHaveProperty('role');
  });
  it('scans beyond 500 ineligible city profiles and finds the later eligible profile', async () => {
    const viewer = `pagination-viewer-${crypto.randomUUID()}`;
    const prefix = `pagination-${crypto.randomUUID()}`;
    const candidateIds = Array.from({ length: 501 }, (_, index) => `${prefix}-${String(index).padStart(3, '0')}`);
    ids.push(...candidateIds);
    for (let offset = 0; offset < candidateIds.length; offset += 400) {
      const batch = getDb().batch();
      candidateIds.slice(offset, offset + 400).forEach((id, index) => {
        const absolute = offset + index;
        batch.set(getDb().collection('public_profiles').doc(id), {
          name: 'Synthetic', age: 28, location: 'Frankfurt am Main', isAdult: true,
          isVerified: absolute === 500, active: true, isExample: false, lastActiveAt: new Date(),
        });
        batch.set(getDb().collection('users').doc(id), { isAdult: true, active: true, isSuspended: false, isBlocked: false });
      });
      await batch.commit();
    }
    const rows = await getRecommendations(getDb(), viewer, { location: 'Frankfurt am Main', limit: 30 });
    expect(rows.map(row => row.id)).toContain(candidateIds[500]);
  }, 60_000);

  it('repeats stable cursor scans without skipped or duplicated IDs', async () => {
    const source = Array.from({ length: 257 }, (_, index) => ({ id: String(index).padStart(4, '0') }));
    const fetchPage = async (cursor: typeof source[number] | undefined, size: number) => source.slice(cursor ? source.findIndex(item => item.id === cursor.id) + 1 : 0, (cursor ? source.findIndex(item => item.id === cursor.id) + 1 : 0) + size);
    const first = await scanRecommendationPages(fetchPage, 37, 500);
    const retry = await scanRecommendationPages(fetchPage, 37, 500);
    expect(first.map(item => item.id)).toEqual(source.map(item => item.id));
    expect(retry.map(item => item.id)).toEqual(first.map(item => item.id));
    expect(new Set(first.map(item => item.id)).size).toBe(source.length);
  });

  it('fails closed when a further page exists beyond the hard scan budget', async () => {
    const source = Array.from({ length: 6 }, (_, index) => ({ id: String(index) }));
    const fetchPage = async (cursor: typeof source[number] | undefined, size: number) => {
      const start = cursor ? Number(cursor.id) + 1 : 0; return source.slice(start, start + size);
    };
    await expect(scanRecommendationPages(fetchPage, 2, 5)).rejects.toThrow('Recommendation scan budget exceeded');
    await expect(scanRecommendationPages(fetchPage, 2, 6)).resolves.toHaveLength(6);
  });

  it('re-evaluates mutable eligibility after later cursor pages are read', async () => {
    const rows = Array.from({ length: 5 }, (_, index) => ({ id: String(index), active: true }));
    const fetchPage = async (cursor: typeof rows[number] | undefined, size: number) => {
      if (cursor?.id === '1') {
        const firstRow = rows[0];
        if (firstRow === undefined) throw new Error('Expected first row during eligibility mutation test');
        firstRow.active = false;
      }
      const start = cursor ? Number(cursor.id) + 1 : 0; return rows.slice(start, start + size);
    };
    const scanned = await scanRecommendationPages(fetchPage, 2, 10);
    expect(scanned.filter(row => row.active).map(row => row.id)).toEqual(['1', '2', '3', '4']);
  });

  it('preserves block, deletion, age, adult, verification and activity exclusions', async () => {
    const viewer = `filter-viewer-${crypto.randomUUID()}`;
    const cases: Array<{ key: string; block?: boolean; deletion?: boolean; age?: number; verified?: boolean; active?: boolean; adult?: boolean }> = [
      { key: 'blocked', block: true }, { key: 'deleted', deletion: true },
      { key: 'underage', age: 17 }, { key: 'unverified', verified: false },
      { key: 'inactive', active: false }, { key: 'not-adult', adult: false }, { key: 'eligible' },
    ];
    const batch = getDb().batch();
    for (const spec of cases) {
      const id = `filter-${viewer}-${spec.key}`; ids.push(id);
      batch.set(getDb().collection('public_profiles').doc(id), {
        name: 'Synthetic', age: spec.age ?? 28, location: 'Köln', isAdult: spec.adult ?? true,
        isVerified: spec.verified ?? true, active: spec.active ?? true, isExample: false, lastActiveAt: new Date(),
      });
      batch.set(getDb().collection('users').doc(id), { isAdult: true, active: true, isSuspended: false, isBlocked: false });
      if (spec.deletion) { deletionIds.push(id); batch.set(getDb().collection('account_deletions').doc(id), { pending: true }); }
      if (spec.block) { const blockId = `block-${id}`; blockIds.push(blockId); batch.set(getDb().collection('blocks').doc(blockId), { blockerUid: viewer, blockedUid: id }); }
    }
    await batch.commit();
    const rows = await getRecommendations(getDb(), viewer, { location: 'Köln', minAge: 18, maxAge: 35 });
    expect(rows.map(row => row.id)).toContain(`filter-${viewer}-eligible`);
    for (const spec of cases.filter(item => item.key !== 'eligible')) expect(rows.map(row => row.id)).not.toContain(`filter-${viewer}-${spec.key}`);
  }, 30_000);

});
