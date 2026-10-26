// @vitest-environment node
import { randomUUID } from 'node:crypto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { getDb } from '../src/server/db';
import { anonymizeIdentifier, checkAccountRateLimit } from '../src/server/passwordReset';

vi.mock('../src/server/db', async importOriginal => {
  const real = await importOriginal<typeof import('../src/server/db')>();
  const { getFirestore } = await import('firebase-admin/firestore');
  return { ...real, getDb: () => getFirestore(real.getServerFirebaseApp(), 'password-reset-security-tests') };
});
const emails: string[] = [];
function address() { const email = 'reset-' + randomUUID() + '@example.test'; emails.push(email); return email; }
function ref(email: string) { return getDb().collection('password_reset_rate_limits').doc(anonymizeIdentifier(email)); }
afterEach(async () => {
  if (!process.env.FIRESTORE_EMULATOR_HOST) return;
  await Promise.all(emails.splice(0).map(email => ref(email).delete()));
});
describe.runIf(Boolean(process.env.FIRESTORE_EMULATOR_HOST))('password recovery quota persistence (isolated emulator database)', () => {
  it('creates a fresh document and recreates it after TTL-equivalent deletion', async () => {
    const email = address(); const doc = ref(email);
    expect((await doc.get()).exists).toBe(false); expect(await checkAccountRateLimit(email)).toBe(true);
    const data = (await doc.get()).data()!;
    expect(data.count).toBe(1); expect(data.expiresAt.toMillis()).toBe(data.windowStartedAt + 3_600_000);
    await doc.delete(); expect(await checkAccountRateLimit(email)).toBe(true);
    expect((await doc.get()).data()!.count).toBe(1);
  });
  it('accepts only three concurrent requests for one previously missing document', async () => {
    const email = address();
    const outcomes = await Promise.all(Array.from({ length: 4 }, () => checkAccountRateLimit(email)));
    expect(outcomes.filter(Boolean)).toHaveLength(3); expect((await ref(email).get()).data()!.count).toBe(3);
    // Real emulator lock contention can trigger SDK transaction backoff. This
    // bounded integration-test timeout is not an HTTP latency/SLO allowance.
  }, 30_000);
  it('replaces an expired window rather than retaining its old expiry', async () => {
    const email = address(), started = Date.now() - 3_600_001;
    await ref(email).set({ count: 3, windowStartedAt: started, expiresAt: new Date(started + 3_600_000) });
    expect(await checkAccountRateLimit(email)).toBe(true);
    const data = (await ref(email).get()).data()!;
    expect(data.count).toBe(1); expect(data.windowStartedAt).toBeGreaterThan(started);
    expect(data.expiresAt.toMillis()).toBe(data.windowStartedAt + 3_600_000);
  });
});
