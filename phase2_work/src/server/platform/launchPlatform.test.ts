import { test } from "vitest";
import assert from 'node:assert/strict';
import { activationScore, densityBand, evaluateCityLaunchReadiness, normalizeLaunchCity, recordActivation, referralCodeFor, toPublicProfile } from './launchPlatform';
process.env.REFERRAL_CODE_SECRET = ['test-only', 'referral', 'secret', '01234567890123456789'].join('-');

test('normalizes supported launch cities', () => {
  assert.equal(normalizeLaunchCity('Muenchen'), 'München');
  assert.equal(normalizeLaunchCity('Berlin'), 'Berlin');
  assert.equal(normalizeLaunchCity('unknown'), null);
});

test('density uses meaningful local thresholds', () => {
  assert.equal(densityBand(0), 'building');
  assert.equal(densityBand(5), 'emerging');
  assert.equal(densityBand(20), 'active');
  assert.equal(densityBand(50), 'strong');
});

test('evaluates city launch readiness and recommendations accurately', () => {
  const lowDensity = evaluateCityLaunchReadiness(3, 1, 'München');
  assert.equal(lowDensity.readyForMatching, false);
  assert.equal(lowDensity.band, 'building');
  assert.equal(lowDensity.recommendation, 'invite_more');

  const unverifiedDensity = evaluateCityLaunchReadiness(25, 5, 'Berlin');
  assert.equal(unverifiedDensity.readyForMatching, true);
  assert.equal(unverifiedDensity.band, 'active');
  assert.equal(unverifiedDensity.recommendation, 'boost_verification');

  const readyDensity = evaluateCityLaunchReadiness(30, 20, 'Hamburg');
  assert.equal(readyDensity.readyForMatching, true);
  assert.equal(readyDensity.band, 'active');
  assert.equal(readyDensity.recommendation, 'ready');
});

test('public profile contains only launch-safe fields', () => {
  const p = toPublicProfile('u1', { name: 'Anna', age: 29, location: 'München', bio: 'x', interests: ['Hiking'], plan: 'plus', moodHistory: ['secret'] });
  assert.equal(p?.id, 'u1');
  assert.equal('plan' in (p ?? {}), false);
  assert.equal('moodHistory' in (p ?? {}), false);
});

test('referral code is deterministic and bounded', () => {
  const a = referralCodeFor('user-1');
  assert.equal(a, referralCodeFor('user-1'));
  assert.match(a, /^[A-Z0-9_-]{10}$/);
});

test('activation score rewards the meaningful connection funnel', () => {
  const result = activationScore(['profile_completed', 'first_recommendations', 'first_contact', 'first_conversation', 'date_planned', 'date_reflected']);
  assert.equal(result.activated, true);
  assert.ok(result.score >= 70);
});


test('recordActivation refuses creation for a deletion-pending account', async () => {
  const creates: unknown[] = [];
  const db = {
    collection: (name: string) => ({ doc: (id: string) => ({ path: name + '/' + id }) }),
    runTransaction: async (fn: (tx: any) => Promise<unknown>) => fn({
      get: async () => ({ exists: true }),
      create: (...args: unknown[]) => creates.push(args),
    }),
  };
  await assert.rejects(
    recordActivation(db as any, 'uid-a', 'first_contact', 'event0001'),
    /Account deletion pending/,
  );
  assert.equal(creates.length, 0);
});

test('recordActivation creates an allowed event only after verifying absence of deletion marker', async () => {
  const order: string[] = [];
  const db = {
    collection: (name: string) => ({ doc: (id: string) => ({ path: name + '/' + id }) }),
    runTransaction: async (fn: (tx: any) => Promise<unknown>) => fn({
      get: async (ref: { path: string }) => {
        order.push('get:' + ref.path);
        return { exists: false };
      },
      create: (ref: { path: string }, data: Record<string, unknown>) => {
        order.push('create:' + ref.path);
        assert.equal(data.uid, 'uid-a');
        assert.equal(data.eventName, 'first_contact');
      },
    }),
  };
  const result = await recordActivation(db as any, 'uid-a', 'first_contact', 'event0002', { step: 'launch' });
  assert.equal(result.eventId, 'event0002');
  assert.deepEqual(order, ['get:account_deletions/uid-a', 'create:activation_events/event0002']);
});

test('recordActivation rejects a deletion marker appearing on a simulated Firestore transaction retry', async () => {
  let attempt = 0;
  const committed: string[] = [];
  const db = {
    collection: (name: string) => ({ doc: (id: string) => ({ path: name + '/' + id }) }),
    runTransaction: async (fn: (tx: any) => Promise<unknown>) => {
      const execute = async () => {
        const writes: string[] = [];
        const result = await fn({
          get: async () => ({ exists: attempt++ > 0 }),
          create: (ref: { path: string }) => writes.push(ref.path),
        });
        // Simulate a Firestore conflict: staged writes are not committed.
        if (attempt === 1) return { result, conflict: true };
        committed.push(...writes);
        return { result, conflict: false };
      };
      const first = await execute();
      if (first.conflict) return (await execute()).result;
      return first.result;
    },
  };
  await assert.rejects(recordActivation(db as any, 'uid-a', 'first_contact', 'event0003'), /Account deletion pending/);
  assert.deepEqual(committed, []);
});
