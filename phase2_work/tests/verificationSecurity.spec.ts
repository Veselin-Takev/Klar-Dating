// @vitest-environment node
import type { Request, Response } from 'express';
import { authMiddleware } from '../src/core/auth/authMiddleware';
import { afterEach, describe, expect, it } from 'vitest';
import { getAuth } from 'firebase-admin/auth';
import { getDb, getServerFirebaseApp } from '../src/server/db';
import { verifyAndCreditAdMobSsv } from '../src/server/platform/admobSsvEngine';
const accounts: string[] = [];
afterEach(async () => {
  for (const uid of accounts.splice(0)) {
    await getDb().recursiveDelete(getDb().collection('users').doc(uid));
    await getAuth(getServerFirebaseApp()).deleteUser(uid);
  }
});
describe('identity and payment trust boundaries', () => {
  it.runIf(!!process.env.FIREBASE_AUTH_EMULATOR_HOST)('a valid registered account cannot self-verify', async () => {
    const signup = await fetch(`http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=emulator`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: `verify-${crypto.randomUUID()}@example.test`, password: 'emulator-only-123!', returnSecureToken: true }) });
    expect(signup.status).toBe(200);
    const { localId, idToken } = await signup.json();
    if (typeof localId !== 'string' || typeof idToken !== 'string') throw new Error('Expected Firebase emulator signup identifiers.');
    accounts.push(localId);
    const user = getDb().collection('users').doc(localId);
    await user.set({ isAdult: true, isVerified: false });
    const endpoint = 'http://localhost:3000/api/verification/verify';
    // The route is permanently retired and returns only a fixed 410 response,
    // even when called without credentials or with a registered account token.
    const anonymousResponse = await fetch(endpoint, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ isVerified: true }) });
    expect(anonymousResponse.status).toBe(410);
    const response = await fetch(endpoint, { method: 'POST', headers: { authorization: `Bearer ${idToken}`, 'content-type': 'application/json' }, body: JSON.stringify({ isVerified: true }) });
    expect(response.status).toBe(410);
    const profile = (await user.get()).data();
    if (!profile) throw new Error('Expected persisted verification profile.');
    expect(profile.isVerified).toBe(false);
  });
  it('does not credit rewards for an arbitrary signature', async () => {
    expect(await verifyAndCreditAdMobSsv({ transaction_id: 'fake', user_id: 'victim', signature: 'any-text' })).toEqual({ ok: false, reason: 'SSV_SIGNATURE_VERIFIER_NOT_CONFIGURED' });
  });
});



describe('API token revocation enforcement', () => {
  it.runIf(!!process.env.FIREBASE_AUTH_EMULATOR_HOST)('rejects the same token after logout in both authentication paths and accepts a new login', async () => {
    const email = `revoke-${crypto.randomUUID()}@example.test`;
    const password = 'emulator-only-123!';
    const authUrl = `http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}/identitytoolkit.googleapis.com/v1`;
    const signup = await fetch(`${authUrl}/accounts:signUp?key=emulator`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, password, returnSecureToken: true }),
    });
    expect(signup.status).toBe(200);
    const identity = await signup.json() as { localId: string; idToken: string };
    expect(typeof identity.localId).toBe('string');
    expect(typeof identity.idToken).toBe('string');
    accounts.push(identity.localId);
    const auth = getAuth(getServerFirebaseApp());
    const claims = await auth.verifyIdToken(identity.idToken, true);
    const request = (token: string, path = '/api/account/status', method = 'GET') => fetch(`http://localhost:3000${path}`, {
      method, headers: { authorization: `Bearer ${token}` },
    });
    const coreStatus = async (token: string) => {
      let status = 200; let passed = false;
      const req = { headers: { authorization: `Bearer ${token}` } } as Request;
      const res = { status(code: number) { status = code; return this; }, json() { return this; } } as unknown as Response;
      await authMiddleware(req, res, () => { passed = true; });
      return { status, passed };
    };
    expect((await request(identity.idToken)).status).toBe(200);
    expect(await coreStatus(identity.idToken)).toEqual({ status: 200, passed: true });
    // Firebase auth_time/revocation comparison has second precision. Cross the
    // issued token's second boundary, rather than relying on an arbitrary sleep.
    const remainingMs = (claims.auth_time + 1) * 1000 - Date.now();
    if (remainingMs >= 0) await new Promise(resolve => setTimeout(resolve, remainingMs + 25));
    const logout = await request(identity.idToken, '/api/auth/logout', 'POST');
    expect(logout.status).toBe(200);
    expect((await auth.getUser(identity.localId)).tokensValidAfterTime).toBeTruthy();
    expect((await request(identity.idToken)).status).toBe(401);
    expect(await coreStatus(identity.idToken)).toEqual({ status: 401, passed: false });
    const signin = await fetch(`${authUrl}/accounts:signInWithPassword?key=emulator`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, password, returnSecureToken: true }),
    });
    expect(signin.status).toBe(200);
    const fresh = await signin.json() as { idToken: string };
    expect(typeof fresh.idToken).toBe('string');
    expect((await request(fresh.idToken)).status).toBe(200);
    expect(await coreStatus(fresh.idToken)).toEqual({ status: 200, passed: true });
    await auth.updateUser(identity.localId, { disabled: true });
    expect((await request(fresh.idToken)).status).toBe(401);
    expect(await coreStatus(fresh.idToken)).toEqual({ status: 401, passed: false });
  });
});
