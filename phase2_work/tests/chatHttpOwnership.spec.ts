// @vitest-environment node
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { getAuth } from 'firebase-admin/auth';
import { getDb, getServerFirebaseApp } from '../src/server/db';

const enabled = Boolean(process.env.FIREBASE_AUTH_EMULATOR_HOST && process.env.FIRESTORE_EMULATOR_HOST);
if (process.env.CI === 'true' && !enabled) throw new Error('CI chat ownership evidence requires Auth and Firestore emulators');
const accounts: { uid: string; token: string }[] = [];
let chatId: string;
const marker = `synthetic-chat-profile-${randomUUID()}`;
const db = () => getDb();
const identity = (index: number) => { const account = accounts[index]; if (!account) throw new Error('Missing test account'); return account; };
const request = (index: number, path = `/api/chats/${chatId}`, body?: unknown) => fetch(`http://127.0.0.1:3000${path}`, {
  method: body === undefined ? 'GET' : 'POST',
  headers: { authorization: `Bearer ${identity(index).token}`, ...(body === undefined ? {} : { 'content-type': 'application/json' }) },
  ...(body === undefined ? {} : { body: JSON.stringify(body) }),
});

beforeAll(async () => {
  if (!enabled) return;
  for (const host of [process.env.FIREBASE_AUTH_EMULATOR_HOST, process.env.FIRESTORE_EMULATOR_HOST]) {
    if (!/^(?:127\.0\.0\.1|localhost|\[::1\]):\d+$/.test(host ?? '')) throw new Error('HTTP ownership tests require local emulators');
  }
  chatId = `http-ownership-${randomUUID()}`;
  for (let index = 0; index < 4; index += 1) {
    const signup = await fetch(`http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=emulator`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: `ownership-${randomUUID()}@example.test`, password: 'emulator-only-123!', returnSecureToken: true }),
    });
    expect(signup.status).toBe(200);
    const data = await signup.json() as { localId: string; idToken: string };
    if (typeof data.localId !== 'string' || typeof data.idToken !== 'string') throw new Error('Invalid emulator signup response');
    accounts.push({ uid: data.localId, token: data.idToken });
    expect((await getAuth(getServerFirebaseApp()).verifyIdToken(data.idToken, true)).uid).toBe(data.localId);
    await db().doc(`users/${data.localId}`).set({ isAdult: index !== 3 });
  }
  for (const index of [0, 1]) await db().doc(`public_profiles/${identity(index).uid}`).set({ name: `Synthetic ${index}`, age: 25, location: 'Berlin', bio: marker });
}, 30_000);
beforeEach(async () => {
  if (!enabled) return;
  const a = identity(0).uid, b = identity(1).uid;
  await Promise.all([
    db().doc(`blocks/${a}_${b}`).delete(), db().doc(`blocks/${b}_${a}`).delete(),
    ...accounts.map(account => db().doc(`account_deletions/${account.uid}`).delete()),
  ]);
  await db().doc(`chats/${chatId}`).set({ participants: [a, b], gateAntwortenA: 2, gateAntwortenB: 2 });
  await db().doc(`chats/${chatId}/messages/receipt`).set({ senderId: b, text: marker, isRead: false });
});
afterAll(async () => {
  if (!enabled) return;
  if (chatId) await db().recursiveDelete(db().doc(`chats/${chatId}`));
  if (accounts.length >= 2) {
    const a = identity(0).uid, b = identity(1).uid;
    await Promise.all([db().doc(`blocks/${a}_${b}`).delete(), db().doc(`blocks/${b}_${a}`).delete()]);
  }
  for (const account of accounts) {
    await Promise.all([db().recursiveDelete(db().doc(`users/${account.uid}`)), db().doc(`public_profiles/${account.uid}`).delete(), db().doc(`account_deletions/${account.uid}`).delete()]);
    await getAuth(getServerFirebaseApp()).deleteUser(account.uid);
  }
}, 30_000);

describe.runIf(enabled)('actual HTTP chat ownership with verified emulator tokens', () => {
  it('allows both participants and returns only the counterpart profile', async () => {
    for (const index of [0, 1]) {
      const response = await request(index); expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.profile.id).toBe(identity(1 - index).uid); expect(body.profile.bio).toBe(marker);
    }
  });
  it('denies an authenticated adult outsider and does not disclose profile data', async () => {
    const status = await request(2, '/api/account/status'); expect(status.status).toBe(200);
    expect((await status.json()).isAdult).toBe(true);
    const response = await request(2); expect(response.status).toBe(403);
    const body = await response.text(); expect(body).not.toContain(marker); expect(body).not.toContain(identity(1).uid);
  });
  it.each([false, true])('denies access for either block direction (reverse=%s)', async reverse => {
    const a = identity(reverse ? 1 : 0).uid, b = identity(reverse ? 0 : 1).uid;
    await db().doc(`blocks/${a}_${b}`).set({ synthetic: true });
    const response = await request(0); expect(response.status).toBe(403);
    expect(await response.text()).not.toContain(marker);
  });
  it('denies a chat while recipient erasure is pending', async () => {
    await db().doc(`account_deletions/${identity(1).uid}`).set({ status: 'pending' });
    const response = await request(0); expect(response.status).toBe(403);
    expect(await response.text()).not.toContain(marker);
  });
  it('denies a requester with pending erasure before reaching the resource', async () => {
    await db().doc(`account_deletions/${identity(0).uid}`).set({ status: 'pending' });
    const response = await request(0); expect(response.status).toBe(409);
    expect(await response.text()).not.toContain(marker);
  });
  it('denies a valid account without the server adult gate', async () => {
    const response = await request(3); expect(response.status).toBe(401);
    expect((await response.json()).code).toBe('alter_fehlt');
  });
  it('rejects a foreign read-receipt write without changing data, then permits its owner', async () => {
    const path = '/api/messages/mark-read', payload = { chatId, messageIds: ['receipt'] };
    expect((await request(2, path, payload)).status).toBe(403);
    expect((await db().doc(`chats/${chatId}/messages/receipt`).get()).data()?.isRead).toBe(false);
    expect((await request(0, path, payload)).status).toBe(200);
    expect((await db().doc(`chats/${chatId}/messages/receipt`).get()).data()?.isRead).toBe(true);
  });
});
