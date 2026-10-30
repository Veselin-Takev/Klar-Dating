// @vitest-environment node
import { emptyDeletionCounts } from '../src/server/deletionAccounting';
import { createHash, randomUUID } from 'node:crypto';
import { DeletionPageComplete, DeletionStoragePageComplete, DeletionTimeSliceComplete } from '../src/server/deletionProgress';
import { runAccountDeletion, type DeletionDependencies } from '../src/server/accountDeletion';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Request, Response } from 'express';
import { getAuth } from 'firebase-admin/auth';
import { getDb } from '../src/server/db';
import { getAppBucket } from '../src/server/storage';
import { handleDeleteAccount } from '../src/server/trustAndSafety';
import { purgeAccountData } from '../src/server/trustAndSafety';

describe('account erasure including archived messages and photos', () => {
  beforeEach(() => vi.stubEnv('CONSENT_AUDIT_SECRET', 'test-only-erasure-audit-key-not-for-production'));
  afterEach(() => vi.unstubAllEnvs());
  it.runIf(!!(process.env.FIREBASE_STORAGE_EMULATOR_HOST && process.env.FIREBASE_AUTH_EMULATOR_HOST))('deletes owned data without recreating an analytics identity', async () => {
    const uid = `erase-${crypto.randomUUID()}`;
    const db = getDb(); const auth = getAuth();
    await auth.createUser({ uid });
    const chat = db.collection('chats').doc(uid);
    await db.collection('users').doc(uid).set({ name: 'Test' });
    await db.collection('users').doc(uid).collection('ai_budget').doc('2026-09-28').set({ reservedUnits: 100 });
    await chat.set({ participants: [uid, 'partner'] });
    await chat.collection('archived_messages').doc('one').set({ senderId: uid, text: 'private' });
    await chat.collection('messages').doc('two').set({ senderId: uid, text: 'private' });
    for (const name of ['analytics_events', 'funnel_events']) await db.collection(name).doc(uid).set({ userId: uid });
    const file = getAppBucket().file(`verification/${uid}/photo.jpg`); await file.save('private-photo');
    let status = 200; let result: any;
    const res = { status(code: number) { status = code; return this; }, json(value: unknown) { result = value; return this; } };
    await handleDeleteAccount({ user: { uid, auth_time: Math.floor(Date.now() / 1000) } } as unknown as Request, res as unknown as Response);
    expect(status).toBe(202); expect(result).toMatchObject({ ok: true, status: 'pending' });
    expect((await auth.getUser(uid)).disabled).toBe(true);
    const job = db.collection('account_deletions').doc(uid);
    expect((await job.get()).data()?.status).toBe('pending');
    // This integration journey owns the concrete Firestore/Storage purge only.
    // Worker leasing, provider ordering, final_sweep and completion are covered
    // by the deterministic deletionLifecycle suite.
    const deletionRequestId = result.requestId as string;
    await expect(purgeAccountData(uid, deletionRequestId)).rejects.toBeInstanceOf(DeletionStoragePageComplete);
    await purgeAccountData(uid, deletionRequestId);
    expect((await db.collection('users').doc(uid).get()).exists).toBe(false);
    expect((await db.collection('users').doc(uid).collection('ai_budget').get()).empty).toBe(true);
    expect((await chat.collection('archived_messages').get()).empty).toBe(true);
    expect((await chat.collection('messages').get()).empty).toBe(true);
    for (const name of ['analytics_events', 'funnel_events']) expect((await db.collection(name).where('userId', '==', uid).get()).empty).toBe(true);
    expect((await file.exists())[0]).toBe(false);
    // The durable job remains pending because this test intentionally does not
    // execute the worker orchestration path. That boundary is tested separately.
    expect((await job.get()).data()).toMatchObject({ status: 'pending', phase: 'purge' });
    await job.delete();
  });
  it.runIf(!!process.env.FIREBASE_STORAGE_EMULATOR_HOST)('finishes a real 51-chat purge and repeats it without orphaning nested data or double-counting cumulative totals', async () => {
    const db = getDb();
    const uid = `erase-pages-${randomUUID()}`;
    const requestId = randomUUID();
    const receipt = db.collection('deletion_log').doc(createHash('sha256').update(`deletion-receipt:${requestId}`).digest('hex'));
    const profile = db.collection('users').doc(uid);
    const job = db.doc(`account_deletions/${uid}`);
    await job.set({ requestId, status: 'pending', accountingVersion: 2, deletedCounts: emptyDeletionCounts() });
    const owned = Array.from({ length: 51 }, (_, i) => db.collection('chats').doc(`${uid}-${i}`));
    const unrelated = db.collection('chats').doc(`${uid}-other`);
    try {
      const batch = db.batch();
      batch.set(profile, { name: 'Synthetic deletion test' });
      for (const ref of [...owned, unrelated]) {
        batch.set(ref, { participants: ref === unrelated ? ['unrelated-user'] : [uid] });
        for (const child of ['messages', 'archived_messages', 'gate_answers']) {
          batch.set(ref.collection(child).doc('sample'), { text: 'synthetic data' });
        }
      }
      await batch.commit();
      for (let page = 0; page < 2; page += 1) {
        await expect(purgeAccountData(uid, requestId)).rejects.toBeInstanceOf(DeletionPageComplete);
        expect((await receipt.get()).exists).toBe(false);
      }
      await purgeAccountData(uid, requestId);
      expect((await profile.get()).exists).toBe(false);
      for (const ref of owned) {
        expect((await ref.get()).exists).toBe(false);
        for (const child of ['messages', 'archived_messages', 'gate_answers']) {
          expect((await ref.collection(child).get()).empty).toBe(true);
        }
      }
      const firstCounts = (await job.get()).data()?.deletedCounts;
      expect(firstCounts).toMatchObject({ chats: 51, nachrichten: 102, gateAntworten: 51 });
      expect((await receipt.get()).exists).toBe(false);
      await purgeAccountData(uid, requestId);
      expect((await job.get()).data()?.deletedCounts).toEqual(firstCounts);
      expect((await receipt.get()).exists).toBe(false);
      expect((await unrelated.get()).exists).toBe(true);
      expect((await unrelated.collection('messages').doc('sample').get()).exists).toBe(true);
    } finally {
      for (const ref of [...owned, unrelated, profile]) await db.recursiveDelete(ref);
      await receipt.delete();
      await job.delete();
    }
  }, 30_000);

  it.runIf(
    /^(localhost|127[.]0[.]0[.]1|\[::1\]):[0-9]{1,5}$/.test(process.env.FIRESTORE_EMULATOR_HOST ?? '')
    && Boolean(process.env.FIREBASE_STORAGE_EMULATOR_HOST)
    && process.env.NODE_ENV !== 'production'
    && [process.env.GCLOUD_PROJECT, process.env.GOOGLE_CLOUD_PROJECT, process.env.FIREBASE_PROJECT_ID]
      .filter(Boolean).every(id => id === 'demo-klar')
  )('purges only owned member-code reservations and is idempotent under Art. 17', async () => {
    const db = getDb();
    const uid = 'member-registry-erasure-' + randomUUID().replaceAll('-', '');
    const unrelatedUid = 'member-registry-other-' + randomUUID().replaceAll('-', '');
    const requestId = randomUUID();
    const suffix = randomUUID().replaceAll('-', '').slice(0, 9).toUpperCase();
    const refs = ['A', 'B', 'C'].map(prefix =>
      db.collection('member_referral_code_registry').doc(prefix + suffix));
    const profile = db.collection('users').doc(uid);
    const job = db.collection('account_deletions').doc(uid);
    try {
      const batch = db.batch();
      batch.set(profile, { name: 'Synthetic account to erase' });
      batch.set(job, {
        requestId, status: 'pending', accountingVersion: 2,
        deletedCounts: emptyDeletionCounts(),
      });
      batch.set(refs[0]!, { ownerUid: uid, status: 'active', codeVersion: 1 });
      batch.set(refs[1]!, { ownerUid: uid, status: 'active', codeVersion: 1 });
      batch.set(refs[2]!, { ownerUid: unrelatedUid, status: 'active', codeVersion: 1 });
      await batch.commit();

      await purgeAccountData(uid, requestId);
      expect((await profile.get()).exists).toBe(false);
      expect((await refs[0]!.get()).exists).toBe(false);
      expect((await refs[1]!.get()).exists).toBe(false);
      expect((await refs[2]!.get()).data()).toMatchObject({
        ownerUid: unrelatedUid, status: 'active', codeVersion: 1,
      });
      expect((await db.collection('member_referral_code_registry')
        .where('ownerUid', '==', uid).get()).empty).toBe(true);

      // Replaying a deletion slice must neither restore the deleted code
      // reservations nor alter an unrelated account's reservation.
      await purgeAccountData(uid, requestId);
      expect((await refs[0]!.get()).exists).toBe(false);
      expect((await refs[1]!.get()).exists).toBe(false);
      expect((await refs[2]!.get()).data()?.ownerUid).toBe(unrelatedUid);
    } finally {
      for (const ref of [...refs, profile, job]) await ref.delete();
    }
  }, 60_000);

  it.runIf(
    /^(localhost|127[.]0[.]0[.]1|\[::1\]):[0-9]{1,5}$/.test(process.env.FIRESTORE_EMULATOR_HOST ?? '')
    && Boolean(process.env.FIREBASE_STORAGE_EMULATOR_HOST)
    && process.env.NODE_ENV !== 'production'
    && [process.env.GCLOUD_PROJECT, process.env.GOOGLE_CLOUD_PROJECT, process.env.FIREBASE_PROJECT_ID]
      .filter(Boolean).every(id => id === 'demo-klar')
  )('deletes 401 owned registry reservations across the 400-document batch boundary', async () => {
    const db = getDb();
    const uid = 'registry-multibatch-' + randomUUID().replaceAll('-', '');
    const unrelatedUid = 'registry-outsider-' + randomUUID().replaceAll('-', '');
    const requestId = randomUUID();
    // Use deterministic 10-character valid code IDs within this isolated test.
    const prefix = randomUUID().replaceAll('-', '').slice(0, 4).toUpperCase();
    const code = (n: number) => prefix + n.toString(36).toUpperCase().padStart(6, '0');
    const registry = db.collection('member_referral_code_registry');
    const owned = Array.from({ length: 401 }, (_, n) => registry.doc(code(n)));
    const unrelated = registry.doc(code(401));
    const profile = db.collection('users').doc(uid);
    const job = db.collection('account_deletions').doc(uid);
    try {
      // 401 owned reservations + foreign + profile + deletion job = 404
      // writes, strictly below Firestore's 500-write batch limit.
      const setup = db.batch();
      setup.set(profile, { name: 'Synthetic multi-batch erasure' });
      setup.set(job, { requestId, status: 'pending',
        accountingVersion: 2, deletedCounts: emptyDeletionCounts() });
      for (const ref of owned) {
        setup.set(ref, { ownerUid: uid, status: 'active', codeVersion: 1 });
      }
      setup.set(unrelated, { ownerUid: unrelatedUid, status: 'active', codeVersion: 1 });
      await setup.commit();

      expect((await registry.where('ownerUid', '==', uid).get()).size).toBe(401);
      await purgeAccountData(uid, requestId);
      expect((await registry.where('ownerUid', '==', uid).get()).empty).toBe(true);
      expect((await profile.get()).exists).toBe(false);
      expect((await unrelated.get()).data()).toMatchObject({
        ownerUid: unrelatedUid, status: 'active', codeVersion: 1,
      });
      // The same request may be retried after an acknowledged batch;
      // no owned record must reappear and no foreign reservation is affected.
      await purgeAccountData(uid, requestId);
      expect((await registry.where('ownerUid', '==', uid).get()).empty).toBe(true);
      expect((await unrelated.get()).data()?.ownerUid).toBe(unrelatedUid);
    } finally {
      const cleanup = db.batch();
      for (const ref of [...owned, unrelated, profile, job]) cleanup.delete(ref);
      await cleanup.commit();
    }
  }, 120_000);

  it.runIf(
    /^(localhost|127[.]0[.]0[.]1|\[::1\]):[0-9]{1,5}$/.test(process.env.FIRESTORE_EMULATOR_HOST ?? '')
    && Boolean(process.env.FIREBASE_STORAGE_EMULATOR_HOST)
    && process.env.NODE_ENV !== 'production'
    && [process.env.GCLOUD_PROJECT, process.env.GOOGLE_CLOUD_PROJECT, process.env.FIREBASE_PROJECT_ID]
      .filter(Boolean).every(id => id === 'demo-klar')
  )('resumes after 400 acknowledged registry deletions and an expired deletion time slice', async () => {
    const db = getDb();
    const uid = 'registry-slice-resume-' + randomUUID().replaceAll('-', '');
    const outsiderUid = 'registry-slice-outsider-' + randomUUID().replaceAll('-', '');
    const requestId = randomUUID();
    const prefix = randomUUID().replaceAll('-', '').slice(0, 4).toUpperCase();
    const registry = db.collection('member_referral_code_registry');
    const code = (n: number) => prefix + n.toString(36).toUpperCase().padStart(6, '0');
    const owned = Array.from({ length: 401 }, (_, n) => registry.doc(code(n)));
    const outsider = registry.doc(code(401));
    const profile = db.collection('users').doc(uid);
    const job = db.collection('account_deletions').doc(uid);
    try {
      const setup = db.batch();
      setup.set(profile, { name: 'Synthetic resumable deletion' });
      setup.set(job, {
        requestId, status: 'pending', accountingVersion: 2,
        deletedCounts: emptyDeletionCounts(),
      });
      for (const ref of owned) {
        setup.set(ref, { ownerUid: uid, status: 'active', codeVersion: 1 });
      }
      setup.set(outsider, { ownerUid: outsiderUid, status: 'active', codeVersion: 1 });
      await setup.commit();

      const startedAt = Date.now();
      let expired = false;
      let acknowledgedProgress = 0;
      // Expire the test-only clock only AFTER a real Firestore batch commit
      // has been acknowledged by recordDeletionProgress(). No data or timing
      // injection reaches the HTTP API, Cloud Scheduler or production worker.
      await expect(purgeAccountData(uid, requestId, undefined, {
        now: () => expired ? startedAt + 60_000 : startedAt,
        onProgress: () => {
          acknowledgedProgress += 1;
          expired = true;
        },
      })).rejects.toBeInstanceOf(DeletionTimeSliceComplete);

      expect(acknowledgedProgress).toBe(1);
      const remaining = await registry.where('ownerUid', '==', uid).get();
      expect(remaining.size).toBe(1);
      expect((await profile.get()).exists).toBe(true);
      expect((await job.get()).data()).toMatchObject({
        requestId, status: 'pending',
      });
      expect((await outsider.get()).data()?.ownerUid).toBe(outsiderUid);

      // Resumption must use the same durable deletion request, not a new
      // request ID or a replaced in-memory mock database.
      await purgeAccountData(uid, requestId);
      expect((await registry.where('ownerUid', '==', uid).get()).empty).toBe(true);
      expect((await profile.get()).exists).toBe(false);
      expect((await outsider.get()).data()?.ownerUid).toBe(outsiderUid);
      await purgeAccountData(uid, requestId);
      expect((await registry.where('ownerUid', '==', uid).get()).empty).toBe(true);
      expect((await outsider.get()).data()?.ownerUid).toBe(outsiderUid);
    } finally {
      const cleanup = db.batch();
      for (const ref of [...owned, outsider, profile, job]) cleanup.delete(ref);
      await cleanup.commit();
    }
  }, 120_000);

  it.runIf(
    /^(localhost|127[.]0[.]0[.]1|\[::1\]):[0-9]{1,5}$/.test(process.env.FIRESTORE_EMULATOR_HOST ?? '')
    && Boolean(process.env.FIREBASE_STORAGE_EMULATOR_HOST)
    && process.env.NODE_ENV !== 'production'
    && [process.env.GCLOUD_PROJECT, process.env.GOOGLE_CLOUD_PROJECT, process.env.FIREBASE_PROJECT_ID]
      .filter(Boolean).every(id => id === 'demo-klar')
  )('hands off a real registry deletion after a completed slice to a new worker lease', async () => {
    const db = getDb();
    const uid = 'registry-worker-handoff-' + randomUUID().replaceAll('-', '');
    const foreignUid = 'registry-worker-foreign-' + randomUUID().replaceAll('-', '');
    const requestId = randomUUID();
    const prefix = randomUUID().replaceAll('-', '').slice(0, 4).toUpperCase();
    const registry = db.collection('member_referral_code_registry');
    const code = (index: number) =>
      prefix + index.toString(36).toUpperCase().padStart(6, '0');
    const owned = Array.from({ length: 401 }, (_, index) => registry.doc(code(index)));
    const foreign = registry.doc(code(401));
    const profile = db.doc('users/' + uid);
    const job = db.doc('account_deletions/' + uid);
    const receipt = db.doc('deletion_log/' +
      createHash('sha256').update('deletion-receipt:' + requestId).digest('hex'));

    let workerNow = Date.now();
    const firstSliceStart = workerNow;
    let sliceExpired = false;
    let acknowledgedBatches = 0;
    const observedLeases: string[] = [];
    let firstPurgeException: unknown;
    const deps: DeletionDependencies = {
      db, now: () => workerNow,
      disable: vi.fn(async () => {}),
      removeAuth: vi.fn(async () => {}),
      cancelSubscription: vi.fn(async () => {}),
      eraseProvider: vi.fn(async () => true),
      purge: vi.fn(async (targetUid, targetRequestId, lease) => {
        expect(targetUid).toBe(uid);
        expect(targetRequestId).toBe(requestId);
        expect(typeof lease).toBe('string');
        observedLeases.push(lease!);
        try {
          return await purgeAccountData(targetUid, targetRequestId, lease,
            observedLeases.length === 1 ? {
              now: () => sliceExpired ? firstSliceStart + 60_000 : firstSliceStart,
              onProgress: () => {
                acknowledgedBatches += 1;
                sliceExpired = true;
              },
            } : undefined);
        } catch (error) {
          if (observedLeases.length === 1) firstPurgeException = error;
          throw error;
        }
      }),
    };

    try {
      const setup = db.batch();
      setup.set(profile, { name: 'Synthetic registry lease handoff account' });
      setup.set(job, {
        requestId, status: 'pending', phase: 'purge',
        accountingVersion: 2, deletedCounts: emptyDeletionCounts(),
        nextAttemptAt: new Date(workerNow), leaseUntil: 0,
        attempts: 0, hasDidit: false, subscriptionId: null,
        customerId: null,
      });
      for (const ref of owned) {
        setup.set(ref, { ownerUid: uid, status: 'active', codeVersion: 1 });
      }
      setup.set(foreign, { ownerUid: foreignUid, status: 'active', codeVersion: 1 });
      await setup.commit();

      // Worker A gets a real durable lease, commits the first 400-record
      // Firestore batch and reaches the time slice boundary.
      await runAccountDeletion(uid, deps);
      expect(firstPurgeException).toBeInstanceOf(DeletionTimeSliceComplete);
      expect(acknowledgedBatches).toBe(1);
      expect(observedLeases).toHaveLength(1);
      const afterA = (await job.get()).data()!;
      expect(afterA).toMatchObject({
        requestId, status: 'pending', phase: 'purge', leaseUntil: 0,
        completedSlices: 1, attempts: 0,
      });
      expect((await registry.where('ownerUid', '==', uid).get()).size).toBe(1);
      expect((await profile.get()).exists).toBe(true);
      expect((await foreign.get()).data()?.ownerUid).toBe(foreignUid);
      expect(deps.removeAuth).not.toHaveBeenCalled();
      expect((await receipt.get()).exists).toBe(false);

      // Job is not eligible until the persisted nextAttemptAt.
      await runAccountDeletion(uid, deps);
      expect(observedLeases).toHaveLength(1);
      workerNow += 1_001;

      // Worker B acquires a NEW lease and finishes the same deletion request.
      await runAccountDeletion(uid, deps);
      expect(observedLeases).toHaveLength(2);
      expect(observedLeases[1]).not.toBe(observedLeases[0]);
      const afterB = (await job.get()).data()!;
      expect(afterB).toMatchObject({
        requestId, status: 'pending', phase: 'final_sweep',
      });
      expect((await registry.where('ownerUid', '==', uid).get()).empty).toBe(true);
      expect((await profile.get()).exists).toBe(false);
      expect((await foreign.get()).data()?.ownerUid).toBe(foreignUid);
      expect(deps.removeAuth).toHaveBeenCalledTimes(1);
      expect((await receipt.get()).exists).toBe(false);

      // Final sweep must remain behind its independent token-grace boundary.
      await runAccountDeletion(uid, deps);
      expect(observedLeases).toHaveLength(2);
      workerNow += 62 * 60_000;
      await runAccountDeletion(uid, deps);
      expect(observedLeases).toHaveLength(3);
      expect(observedLeases[2]).not.toBe(observedLeases[1]);
      expect((await job.get()).data()?.status).toBe('completed');
      expect((await receipt.get()).data()).toMatchObject({
        schemaVersion: 2, status: 'completed',
      });
      expect((await foreign.get()).data()?.ownerUid).toBe(foreignUid);
      await runAccountDeletion(uid, deps);
      expect(observedLeases).toHaveLength(3);
    } finally {
      const cleanup = db.batch();
      for (const ref of [...owned, foreign, profile, job]) cleanup.delete(ref);
      await cleanup.commit();
      await receipt.delete();
    }
  }, 120_000);

  it('requires recent authentication before creating a destructive job', async () => {
    let status = 200;
    const res = { status(code: number) { status = code; return this; }, json() { return this; } };
    await handleDeleteAccount({ user: { uid: 'stale-session', auth_time: Math.floor(Date.now() / 1000) - 600 } } as unknown as Request, res as unknown as Response);
    expect(status).toBe(401);
    expect((await getDb().doc('account_deletions/stale-session').get()).exists).toBe(false);
  });
});

