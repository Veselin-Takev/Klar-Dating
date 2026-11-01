// @vitest-environment node
// Native Firestore emulator only: no physical GCS calls or customer records.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { deleteApp, initializeApp, type App } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import {
  claimPurgeWork, createPurgeWork, markDeletionIntent,
} from '../src/server/platform/verificationPurgeWorkState';
import { transitionPurgeWorkInTransaction } from '../src/server/platform/verificationPurgeWorkFirestore';

const host = process.env.FIRESTORE_EMULATOR_HOST || '';
const emulatorOnly = /^(?:127\.0\.0\.1|localhost|\[::1\]):\d{2,5}$/.test(host) &&
  (!process.env.GCLOUD_PROJECT || process.env.GCLOUD_PROJECT === 'demo-klar') &&
  (!process.env.GOOGLE_CLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT === 'demo-klar');
const t0 = Date.parse('2026-11-01T00:00:00Z');
const workerA = 'emulator-worker-a-00000001';
const workerB = 'emulator-worker-b-00000001';

describe.skipIf(!emulatorOnly)('P0 #202: native Firestore Emulator lease concurrency and crash barriers', () => {
  let app: App;
  let db: Firestore;

  beforeAll(() => {
    // A hard-coded *demo* project and a verified loopback emulator host.
    // No ADC, production project, Storage or Scheduler is ever accessed.
    app = initializeApp({ projectId: 'demo-klar' }, `p0-retention-${randomUUID()}`);
    db = getFirestore(app);
  });

  afterAll(async () => {
    if (app) await deleteApp(app);
  });

  it('two real concurrent Firestore transactions cannot both claim the same job', async () => {
    const id = randomUUID().replaceAll('-', '');
    const ref = db.collection('verification_purge_jobs').doc(id);
    await ref.set(createPurgeWork(id, t0));
    try {
      const attempts = await Promise.allSettled([
        transitionPurgeWorkInTransaction(db, ref, current => claimPurgeWork(current, workerA, t0, 5_000)),
        transitionPurgeWorkInTransaction(db, ref, current => claimPurgeWork(current, workerB, t0, 5_000)),
      ]);
      expect(attempts.filter(x => x.status === 'fulfilled')).toHaveLength(1);
      expect(attempts.filter(x => x.status === 'rejected')).toHaveLength(1);
      const data = (await ref.get()).data();
      expect(data).toMatchObject({ schemaVersion: 1, status: 'leased', revision: 1, attempt: 1 });
      expect([workerA, workerB]).toContain(data?.lease?.token);
    } finally {
      await ref.delete();
    }
  }, 20_000);

  it('persisted write-ahead intent survives worker restart and rejects expired re-claim', async () => {
    const id = randomUUID().replaceAll('-', '');
    const ref = db.collection('verification_purge_jobs').doc(id);
    await ref.set(createPurgeWork(id, t0));
    try {
      await transitionPurgeWorkInTransaction(db, ref, current =>
        claimPurgeWork(current, workerA, t0, 5_000));
      const committed = await transitionPurgeWorkInTransaction(db, ref, current =>
        markDeletionIntent(current, workerA, 1, t0 + 100, '18446744073709551615'));
      expect(committed).toMatchObject({
        status: 'delete_intent', revision: 2, intent: { leaseEpoch: 1, generation: '18446744073709551615' },
      });
      // Simulate process restart with a fresh Firestore client reading persisted state.
      const fresh = await ref.get();
      expect(fresh.data()?.status).toBe('delete_intent');
      await expect(transitionPurgeWorkInTransaction(db, ref, current =>
        claimPurgeWork(current, workerB, t0 + 100_000, 5_000)))
        .rejects.toThrow('purge_work_not_claimable');
      const unchanged = (await ref.get()).data();
      expect(unchanged).toMatchObject({ status: 'delete_intent', revision: 2, attempt: 1 });
      expect(unchanged?.intent?.generation).toBe('18446744073709551615');
    } finally {
      await ref.delete();
    }
  }, 20_000);

  it('transactional adapter blocks a forged ready-to-complete jump', async () => {
    const id = randomUUID().replaceAll('-', '');
    const ref = db.collection('verification_purge_jobs').doc(id);
    await ref.set(createPurgeWork(id, t0));
    try {
      await expect(transitionPurgeWorkInTransaction(db, ref, current => ({
        ...current, revision: current.revision + 1, status: 'complete',
        receiptDigest: 'a'.repeat(64), completedAt: t0 + 1,
      }))).rejects.toThrow('purge_work_transition_invariant');
      expect((await ref.get()).data()?.status).toBe('ready');
      expect((await ref.get()).data()?.revision).toBe(0);
    } finally {
      await ref.delete();
    }
  }, 20_000);
});
