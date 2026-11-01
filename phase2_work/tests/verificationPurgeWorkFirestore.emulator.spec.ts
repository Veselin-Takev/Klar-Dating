// @vitest-environment node
// Native Firestore Emulator only. No cloud GCS or customer data.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { deleteApp, initializeApp, type App } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import { createPurgeWork } from '../src/server/platform/verificationPurgeWorkState';
import {
  executePurgeWorkCommand, type PurgeWorkCommand,
} from '../src/server/platform/verificationPurgeWorkFirestore';

const host = process.env.FIRESTORE_EMULATOR_HOST || '';
const emulatorOnly = /^(?:127\.0\.0\.1|localhost|\[::1\]):\d{2,5}$/.test(host) &&
  (!process.env.GCLOUD_PROJECT || process.env.GCLOUD_PROJECT === 'demo-klar') &&
  (!process.env.GOOGLE_CLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT === 'demo-klar');
const t0 = Date.parse('2026-11-01T00:00:00Z');
const workerA = 'emulator-worker-a-00000001';
const workerB = 'emulator-worker-b-00000001';
const claim = (token: string, now = t0): PurgeWorkCommand => ({ kind: 'claim', token, now, leaseMs: 5_000 });

describe.skipIf(!emulatorOnly)('P0 #202 native Firestore Emulator typed command boundaries', () => {
  let app: App;
  let db: Firestore;

  beforeAll(() => {
    app = initializeApp({ projectId: 'demo-klar' }, `p0-typed-commands-${randomUUID()}`);
    db = getFirestore(app);
  });

  afterAll(async () => { if (app) await deleteApp(app); });

  it('two real concurrent claim commands cannot both lease the same job', async () => {
    const id = randomUUID().replaceAll('-', '');
    const ref = db.collection('verification_purge_jobs').doc(id);
    await ref.set(createPurgeWork(id, t0));
    try {
      const outcomes = await Promise.allSettled([
        executePurgeWorkCommand(db, ref, claim(workerA)),
        executePurgeWorkCommand(db, ref, claim(workerB)),
      ]);
      expect(outcomes.filter(x => x.status === 'fulfilled')).toHaveLength(1);
      expect(outcomes.filter(x => x.status === 'rejected')).toHaveLength(1);
      const row = (await ref.get()).data();
      expect(row).toMatchObject({ status: 'leased', revision: 1, attempt: 1 });
      expect([workerA, workerB]).toContain(row?.lease?.token);
    } finally { await ref.delete(); }
  }, 20_000);

  it('a committed write-ahead intent survives reads and denies expired re-claim', async () => {
    const id = randomUUID().replaceAll('-', '');
    const ref = db.collection('verification_purge_jobs').doc(id);
    await ref.set(createPurgeWork(id, t0));
    try {
      await executePurgeWorkCommand(db, ref, claim(workerA));
      const intent = await executePurgeWorkCommand(db, ref, {
        kind: 'prepare_delete_intent', token: workerA, epoch: 1, now: t0 + 100,
        generation: '18446744073709551615',
      });
      expect(intent).toMatchObject({
        status: 'delete_intent', revision: 2,
        intent: { generation: '18446744073709551615', leaseEpoch: 1 },
      });
      expect((await ref.get()).data()?.status).toBe('delete_intent');
      await expect(executePurgeWorkCommand(db, ref, claim(workerB, t0 + 100_000)))
        .rejects.toThrow('purge_work_not_claimable');
      expect((await ref.get()).data()).toMatchObject({ status: 'delete_intent', revision: 2, attempt: 1 });
    } finally { await ref.delete(); }
  }, 20_000);

  it('forged completion command cannot commit even a plausible audit digest', async () => {
    const id = randomUUID().replaceAll('-', '');
    const ref = db.collection('verification_purge_jobs').doc(id);
    await ref.set(createPurgeWork(id, t0));
    try {
      await expect(executePurgeWorkCommand(db, ref, {
        kind: 'complete', receiptDigest: 'a'.repeat(64), completedAt: t0 + 1,
      } as unknown as PurgeWorkCommand)).rejects.toThrow('purge_work_unsupported_command');
      expect((await ref.get()).data()).toMatchObject({ status: 'ready', revision: 0 });
    } finally { await ref.delete(); }
  }, 20_000);

  it('forged attempt/lease keys are denied before a Firestore write', async () => {
    const id = randomUUID().replaceAll('-', '');
    const ref = db.collection('verification_purge_jobs').doc(id);
    await ref.set(createPurgeWork(id, t0));
    try {
      await expect(executePurgeWorkCommand(db, ref, {
        ...claim(workerA), attempt: 0, lease: { epoch: 9000, token: workerB },
      } as unknown as PurgeWorkCommand)).rejects.toThrow('purge_work_unsupported_command');
      expect((await ref.get()).data()).toMatchObject({ status: 'ready', revision: 0, attempt: 0 });
    } finally { await ref.delete(); }
  }, 20_000);
});
