// @vitest-environment node
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
    const response = await fetch('http://localhost:3000/api/verification/verify', { method: 'POST', headers: { authorization: `Bearer ${idToken}`, 'content-type': 'application/json' }, body: JSON.stringify({ isVerified: true }) });
    expect(response.status).toBe(410);
    const profile = (await user.get()).data();
    if (!profile) throw new Error('Expected persisted verification profile.');
    expect(profile.isVerified).toBe(false);
  });
  it('does not credit rewards for an arbitrary signature', async () => {
    expect(await verifyAndCreditAdMobSsv({ transaction_id: 'fake', user_id: 'victim', signature: 'any-text' })).toEqual({ ok: false, reason: 'SSV_SIGNATURE_VERIFIER_NOT_CONFIGURED' });
  });
});
