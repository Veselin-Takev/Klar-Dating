// @vitest-environment node
import { describe, expect, it } from 'vitest';
import type { Request, Response } from 'express';
import { getAuth } from 'firebase-admin/auth';
import { getDb } from '../src/server/db';
import { getAppBucket } from '../src/server/storage';
import { handleDeleteAccount } from '../src/server/trustAndSafety';
import { deletionDependencies, runAccountDeletion } from '../src/server/accountDeletion';

describe('account erasure including archived messages and photos', () => {
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
    const deps = deletionDependencies();
    // This journey owns Firestore/Storage purge verification; provider-side
    // disable/delete is covered by injected lifecycle tests and production runtime paths.
    deps.disable = async () => {};
    deps.eraseProvider = async () => true;
    deps.cancelSubscription = async () => {};
    deps.removeAuth = async () => {};
    await runAccountDeletion(uid, deps);
    expect((await db.collection('users').doc(uid).get()).exists).toBe(false);
    expect((await db.collection('users').doc(uid).collection('ai_budget').get()).empty).toBe(true);
    expect((await chat.collection('archived_messages').get()).empty).toBe(true);
    expect((await chat.collection('messages').get()).empty).toBe(true);
    for (const name of ['analytics_events', 'funnel_events']) expect((await db.collection(name).where('userId', '==', uid).get()).empty).toBe(true);
    expect((await file.exists())[0]).toBe(false);
    // Auth provider deletion is isolated from emulator-backed data-purge coverage;
    // the deterministic deletionLifecycle suite proves completion after a
    // successful provider deletion, while this journey proves owned-data purge.
    expect((await job.get()).data()?.phase).toBe('final_sweep');
    // Simulate a late upload made with a previously issued Storage token.
    await file.save('late-photo');
    await runAccountDeletion(uid, { ...deletionDependencies(), now: () => Date.now() + 62 * 60_000 });
    expect((await file.exists())[0]).toBe(false);
    expect((await job.get()).data()?.status).toBe('completed');
    await job.delete();
  });
  it('requires recent authentication before creating a destructive job', async () => {
    let status = 200;
    const res = { status(code: number) { status = code; return this; }, json() { return this; } };
    await handleDeleteAccount({ user: { uid: 'stale-session', auth_time: Math.floor(Date.now() / 1000) - 600 } } as unknown as Request, res as unknown as Response);
    expect(status).toBe(401);
    expect((await getDb().doc('account_deletions/stale-session').get()).exists).toBe(false);
  });
});
