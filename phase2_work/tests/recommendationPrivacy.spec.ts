// @vitest-environment node
import { afterEach, describe, expect, it } from 'vitest';
import { getDb } from '../src/server/db';
import { getRecommendations, toPublicProfile } from '../src/server/platform/launchPlatform';
import { compatibilityScore } from '../src/server/platform/compatibility';
const ids: string[] = [];
const blockIds: string[] = [];
afterEach(async () => { for (const id of blockIds.splice(0)) await getDb().collection('blocks').doc(id).delete(); for (const id of ids.splice(0)) await getDb().collection('public_profiles').doc(id).delete(); });
const music = { genres: ['Jazz'], concertGoer: true, playingInstrument: true };
describe('published preferences and recommendation privacy', () => {
  it('excludes blocks beyond the first page in both directions', async () => {
    const viewer = `blocked-viewer-${crypto.randomUUID()}`;
    const candidate = `blocked-candidate-${crypto.randomUUID()}`; ids.push(candidate);
    await getDb().collection('public_profiles').doc(candidate).set({ name: 'Blocked', age: 28, location: 'Berlin', isVerified: true, active: true, lastActiveAt: new Date() });
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
    const profile = toPublicProfile('a', { name: 'Anna', age: 28, location: 'Berlin', musicPreferences: music, email: 'private@example.test' });
    expect(profile?.musicPreferences).toEqual(music); expect(profile).not.toHaveProperty('email');
  });
  it('uses the requested 30 percent music weighting in the active server algorithm', () => {
    expect(compatibilityScore({ interests: ['Musik'], musicPreferences: music }, { interests: ['Musik'], musicPreferences: music })).toBe(100);
    expect(compatibilityScore({ interests: ['Musik'], musicPreferences: music }, { interests: ['Musik'], musicPreferences: { genres: ['Rock'], concertGoer: false, playingInstrument: false } })).toBe(70);
  });
  it('does not return legacy private fields from an existing public document', async () => {
    const id = `privacy-${crypto.randomUUID()}`; ids.push(id);
    await getDb().collection('public_profiles').doc(id).set({ name: 'Test', age: 28, location: 'Berlin', isVerified: true, active: true, lastActiveAt: new Date(), musicPreferences: music, email: 'private@example.test', einwilligung: { evidenceId: 'private' }, role: 'admin' });
    const rows = await getRecommendations(getDb(), 'viewer', { location: 'Berlin', musicPreferences: music });
    const profile = rows.find(row => row.id === id)?.profile;
    expect(profile).toBeDefined(); expect(profile).not.toHaveProperty('email'); expect(profile).not.toHaveProperty('einwilligung'); expect(profile).not.toHaveProperty('role');
  });
});
