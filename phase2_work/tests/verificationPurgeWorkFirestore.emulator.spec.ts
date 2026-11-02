// @vitest-environment node
// Native Firestore Emulator only. No cloud GCS or customer data.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { deleteApp, initializeApp, type App } from 'firebase-admin/app';
import { FieldPath, getFirestore, type Firestore, type QueryDocumentSnapshot } from 'firebase-admin/firestore';
import { createPurgeWork } from '../src/server/platform/verificationPurgeWorkState';
import { censusVerificationRetentionBacklog } from '../src/server/platform/verificationBacklogCensus';
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
const claim = (token: string): PurgeWorkCommand => ({ kind: 'claim', token, leaseMs: 5_000 });

const ciRequiresEmulator = process.env.CI === 'true' || process.env.GITHUB_ACTIONS === 'true';

describe.skipIf(!emulatorOnly && !ciRequiresEmulator)('P0 #202 native Firestore Emulator typed command boundaries', () => {
  let app: App;
  let db: Firestore;

  beforeAll(() => {
    if (!emulatorOnly) throw new Error('retention_firestore_emulator_loopback_required');
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
        kind: 'prepare_delete_intent', token: workerA, epoch: 1,
        generation: '18446744073709551615',
      });
      expect(intent).toMatchObject({
        status: 'delete_intent', revision: 2,
        intent: { generation: '18446744073709551615', leaseEpoch: 1 },
      });
      expect((await ref.get()).data()?.status).toBe('delete_intent');
      await expect(executePurgeWorkCommand(db, ref, claim(workerB)))
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

  it('native Firestore rejects caller-clock overrides before writing a lease', async () => {
    const id = randomUUID().replaceAll('-', '');
    const ref = db.collection('verification_purge_jobs').doc(id);
    await ref.set(createPurgeWork(id, t0));
    try {
      await expect(executePurgeWorkCommand(db, ref, {
        ...claim(workerB), now: t0 + 10 * 365 * 24 * 60 * 60 * 1000,
      } as unknown as PurgeWorkCommand)).rejects.toThrow('purge_work_unsupported_command');
      expect((await ref.get()).data()).toMatchObject({ status: 'ready', revision: 0, attempt: 0 });
    } finally { await ref.delete(); }
  }, 20_000);

  it('native Firestore rejects accessor-based command spoofing without running getters', async () => {
    const id = randomUUID().replaceAll('-', '');
    const ref = db.collection('verification_purge_jobs').doc(id);
    await ref.set(createPurgeWork(id, t0));
    let getterCalls = 0;
    try {
      const attack: Record<string, unknown> = { kind: 'claim', leaseMs: 5_000 };
      Object.defineProperty(attack, 'token', { enumerable: true, get() {
        getterCalls++;
        return workerA;
      } });
      await expect(executePurgeWorkCommand(db, ref, attack as unknown as PurgeWorkCommand))
        .rejects.toThrow('purge_work_unsupported_command');
      expect(getterCalls).toBe(0);
      expect((await ref.get()).data()).toMatchObject({ status: 'ready', revision: 0, attempt: 0 });
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

  it.each([
    '18446744073709551616',
    '99999999999999999999',
    '000123',
    '9'.repeat(4096),
  ])('rejects noncanonical or oversized generation before any Firestore write: %s', async (generation) => {
    const id = randomUUID().replaceAll('-', '');
    const ref = db.collection('verification_purge_jobs').doc(id);
    await ref.set(createPurgeWork(id, t0));
    try {
      // A stale/forged command must be denied before database IO, not only
      // after a lease is acquired or any write-ahead intent is persisted.
      await expect(executePurgeWorkCommand(db, ref, {
        kind: 'prepare_delete_intent', token: workerA, epoch: 1, generation,
      })).rejects.toThrow('purge_work_unsupported_command');
      expect((await ref.get()).data()).toMatchObject({
        status: 'ready', revision: 0, attempt: 0,
      });
    } finally { await ref.delete(); }
  }, 20_000);


  it.each([
    { marker: { receiptDigest: 'a'.repeat(64) }, label: 'receipt digest' },
    { marker: { completedAt: t0 + 1 }, label: 'completion timestamp' },
    { marker: { intent: { generation: '123', preparedAt: t0, leaseEpoch: 1 } }, label: 'write-ahead delete intent' },
    { marker: { observed: { generation: '123', observedAt: t0 } }, label: 'delete observation' },
    { marker: { quarantineReason: 'legal_hold' }, label: 'legal-hold quarantine' },
  ])('fails closed on corrupt ready state with prior $label without any Firestore update', async ({ marker }) => {
    const id = randomUUID().replaceAll('-', '');
    const ref = db.collection('verification_purge_jobs').doc(id);
    await ref.set({ ...createPurgeWork(id, t0), ...marker });
    try {
      await expect(executePurgeWorkCommand(db, ref, claim(workerA)))
        .rejects.toThrow('purge_work_invalid_state');
      expect((await ref.get()).data()).toMatchObject({
        ...marker, status: 'ready', revision: 0, attempt: 0,
      });
    } finally { await ref.delete(); }
  }, 20_000);

  it('refuses to prepare a fresh delete intent on a leased row with an old receipt marker', async () => {
    const id = randomUUID().replaceAll('-', '');
    const ref = db.collection('verification_purge_jobs').doc(id);
    await ref.set(createPurgeWork(id, t0));
    try {
      const leased = await executePurgeWorkCommand(db, ref, claim(workerA));
      expect(leased).toMatchObject({ status: 'leased', revision: 1 });
      await ref.update({ receiptDigest: 'b'.repeat(64) });
      await expect(executePurgeWorkCommand(db, ref, {
        kind: 'prepare_delete_intent', token: workerA, epoch: 1, generation: '123',
      })).rejects.toThrow('purge_work_invalid_state');
      expect((await ref.get()).data()).toMatchObject({
        status: 'leased', revision: 1, attempt: 1, receiptDigest: 'b'.repeat(64),
      });
      expect((await ref.get()).data()).not.toHaveProperty('intent');
    } finally { await ref.delete(); }
  }, 20_000);


  it('read-only census handles 350 real emulator records with complete versus truncated pagination', async () => {
    // Synthetic, isolated emulator data only. The production purge worker is
    // intentionally inert; this proves inventory pagination, NOT 350 deletes.
    const collection = db.collection('verification_census_probe_' + randomUUID().replaceAll('-', ''));
    const documents = Array.from({ length: 350 }, (_, i) =>
      collection.doc('event-' + String(i).padStart(3, '0')));
    const setup = db.batch();
    for (const [i, doc] of documents.entries()) {
      const pending = i >= 310;
      setup.set(doc, {
        uid: 'synthetic-emulator-owner',
        storagePath: i === 10 ? 'verification/synthetic-emulator-owner/../other.jpg'
          : i === 20 ? 'verification/synthetic-emulator-owner//photo.jpg'
          : i === 30 ? 'verification/synthetic-emulator-owner/./photo.jpg'
          : i === 40 ? 'verification/synthetic-emulator-owner/name\\part.jpg'
          : 'verification/synthetic-emulator-owner/photo-' + (i === 301 ? 0 : i) + '.jpg',
        fotoLoeschenAb: new Date(t0 + (pending ? 86_400_000 : -86_400_000)),
        status: pending ? 'pending' : 'approved',
        entscheidung: pending ? 'ausstehend' : 'bestaetigt',
        photoPurged: false,
        legalHold: i % 35 === 0,
      });
    }
    await setup.commit();
    try {
      const source = collection.orderBy(FieldPath.documentId());
      const readPage = async (cursor: QueryDocumentSnapshot | undefined, limit: number) => {
        const page = await (cursor ? source.startAfter(cursor) : source).limit(limit).get();
        return {
          rows: page.docs.map(doc => ({ id: doc.id, data: doc.data() })),
          lastCursor: page.docs.at(-1),
        };
      };
      const partial = await censusVerificationRetentionBacklog(readPage, {
        now: t0, pageSize: 100, maxPages: 3,
      });
      expect(partial).toMatchObject({
        scanned: 300, pagesScanned: 3, complete: false, truncated: true,
        consistency: 'non_atomic_paginated_read', readOnly: true,
      });
      const full = await censusVerificationRetentionBacklog(readPage, {
        now: t0, pageSize: 100, maxPages: 4,
      });
      expect(full).toMatchObject({
        scanned: 350, pagesScanned: 4, complete: true, truncated: false,
        dueByMarker: 310, futureByMarker: 40, pendingOrUnknownDecision: 40,
        knownLegalHolds: 10, duplicatedObjectPaths: 1, invalidOwnerOrPath: 4,
        readOnly: true, consistency: 'non_atomic_paginated_read',
      });
      expect(JSON.stringify(full)).not.toContain('synthetic-emulator-owner');
      expect(JSON.stringify(full)).not.toContain('verification/');
      expect(full).not.toHaveProperty('rows');
      expect(full).not.toHaveProperty('lastCursor');
      // The census itself cannot mutate Firestore. All 350 fixture documents
      // must still exist before cleanup, including held and pending records.
      expect((await collection.get()).size).toBe(350);
    } finally {
      const cleanup = db.batch();
      for (const doc of documents) cleanup.delete(doc);
      await cleanup.commit();
    }
  }, 90_000);

});
