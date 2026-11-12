// @vitest-environment node
import { emptyDeletionCounts } from '../src/server/deletionAccounting';
import { createHash, randomUUID } from 'node:crypto';
import { DeletionPageComplete } from '../src/server/deletionProgress';
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
  it.runIf(!!(process.env.FIREBASE_STORAGE_EMULATOR_HOST && process.env.FIREBASE_AUTH_EMULATOR_HOST))('keeps Art.17 deletion pending when verification Storage objects cannot be safely erased', async () => {
    const uid = `erase-${randomUUID()}`;
    const db = getDb();
    const auth = getAuth();
    await auth.createUser({ uid });
    const user = db.collection('users').doc(uid);
    const job = db.collection('account_deletions').doc(uid);
    const photo = getAppBucket().file(`verification/${uid}/photo.jpg`);
    await user.set({ name: 'Synthetic P0 erasure' });
    await photo.save('private-photo');
    let status = 200;
    let result: any;
    const res = {
      status(code: number) { status = code; return this; },
      json(value: unknown) { result = value; return this; },
    };
    try {
      await handleDeleteAccount({ user: { uid, auth_time: Math.floor(Date.now() / 1000) } } as unknown as Request, res as unknown as Response);
      expect(status).toBe(202);
      expect(result).toMatchObject({ ok: true, status: 'pending' });
      const requestId = result.requestId as string;
      await expect(purgeAccountData(uid, requestId)).rejects.toThrow('verification_photo_p0_fencing_unverified');
      expect((await photo.exists())[0]).toBe(true);
      expect((await job.get()).data()?.status).toBe('pending');
      // No completed deletion receipt may be created for an unresolved photo.
      expect((await job.get()).data()?.status).not.toBe('completed');
    } finally {
      await photo.delete();
      await db.recursiveDelete(user);
      await job.delete();
      await auth.deleteUser(uid);
    }
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

  it('requires recent authentication before creating a destructive job', async () => {
    let status = 200;
    const res = { status(code: number) { status = code; return this; }, json() { return this; } };
    await handleDeleteAccount({ user: { uid: 'stale-session', auth_time: Math.floor(Date.now() / 1000) - 600 } } as unknown as Request, res as unknown as Response);
    expect(status).toBe(401);
    expect((await getDb().doc('account_deletions/stale-session').get()).exists).toBe(false);
  });
});

