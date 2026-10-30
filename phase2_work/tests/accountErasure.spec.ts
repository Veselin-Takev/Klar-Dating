// @vitest-environment node
import { emptyDeletionCounts } from '../src/server/deletionAccounting';
import { createHash, randomUUID } from 'node:crypto';
import { DeletionPageComplete, DeletionStoragePageComplete } from '../src/server/deletionProgress';
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
    /^(localhost|127[.]0[.]0[.]1|\\[::1\\]):[0-9]{1,5}$/.test(process.env.FIRESTORE_EMULATOR_HOST ?? '')
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

  it('requires recent authentication before creating a destructive job', async () => {
    let status = 200;
    const res = { status(code: number) { status = code; return this; }, json() { return this; } };
    await handleDeleteAccount({ user: { uid: 'stale-session', auth_time: Math.floor(Date.now() / 1000) - 600 } } as unknown as Request, res as unknown as Response);
    expect(status).toBe(401);
    expect((await getDb().doc('account_deletions/stale-session').get()).exists).toBe(false);
  });
});

