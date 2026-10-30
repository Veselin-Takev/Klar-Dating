// @vitest-environment node
// P0 #48: real Firestore emulator integration; never access a deployed database.
import { afterEach, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { getDb } from '../src/server/db';
import {
  MEMBER_REFERRAL_CODE_REGISTRY,
  reserveMemberReferralCode,
} from '../src/server/memberReferralCodeRegistry';

const host = process.env.FIRESTORE_EMULATOR_HOST ?? '';
if (host || process.env.KLAR_REQUIRE_FIRESTORE_EMULATOR === '1') {
  const config = JSON.parse(readFileSync(
    process.env.KLAR_REQUIRE_FIRESTORE_EMULATOR === '1'
      ? 'firebase.pruefung.json' : 'firebase.json', 'utf8',
  ));
  const local = /^(localhost|127[.]0[.]0[.]1|\[::1\]):([0-9]{1,5})$/.exec(host);
  const ids = [process.env.GCLOUD_PROJECT, process.env.GOOGLE_CLOUD_PROJECT,
    process.env.FIREBASE_PROJECT_ID].filter(Boolean);
  if (!local || Number(local[2]) !== config?.emulators?.firestore?.port
    || ids.some(id => id !== 'demo-klar')
    || process.env.NODE_ENV === 'production'
    || process.env.KLAR_ALLOW_DURABLE_DB_FALLBACK === 'true') {
    throw new Error('member_referral_registry_emulator_unsafe_target');
  }
}

const tracked: string[] = [];
afterEach(async () => {
  if (!host) return;
  const db = getDb();
  await Promise.all(tracked.splice(0).map(path => db.doc(path).delete()));
});

describe.skipIf(!host)('proposed member referral code reservation (real Firestore emulator)', () => {
  it('serializes two simultaneous first issuers of one colliding code and preserves replay', async () => {
    const db = getDb();
    const suffix = randomUUID().replaceAll('-', '');
    const a = 'registry-a-' + suffix;
    const b = 'registry-b-' + suffix;
    const code = 'R' + suffix.slice(0, 9).toUpperCase();
    tracked.push('users/' + a, 'users/' + b, MEMBER_REFERRAL_CODE_REGISTRY + '/' + code);
    const batch = db.batch();
    batch.set(db.collection('users').doc(a), { isAdult: true, isVerified: false });
    batch.set(db.collection('users').doc(b), { isAdult: true, isVerified: false });
    await batch.commit();

    const outcomes = await Promise.all([
      reserveMemberReferralCode(db, a, code),
      reserveMemberReferralCode(db, b, code),
    ]);
    expect(outcomes.map(x => x.status).sort()).toEqual(['conflict', 'created']);
    const winner = outcomes[0]?.status === 'created' ? a : b;
    const loser = winner === a ? b : a;
    const reg = await db.collection(MEMBER_REFERRAL_CODE_REGISTRY).doc(code).get();
    expect(reg.data()).toMatchObject({
      ownerUid: winner, codeVersion: 1, status: 'active',
    });
    expect((await db.collection('users').doc(winner).get()).data())
      .toMatchObject({ referralCode: code, isVerified: false });
    expect((await db.collection('users').doc(loser).get()).data()?.referralCode).toBeUndefined();
    await expect(reserveMemberReferralCode(db, winner, code))
      .resolves.toEqual({ status: 'already_owned' });
    await expect(reserveMemberReferralCode(db, loser, code))
      .resolves.toEqual({ status: 'conflict' });
    expect((await db.collection(MEMBER_REFERRAL_CODE_REGISTRY).doc(code).get()).data()?.ownerUid)
      .toBe(winner);
    expect((await db.collection('users').doc(winner).get()).data()?.referralQualified)
      .not.toBe(true);
  }, 120_000);

  it('blocks duplicate legacy owners without writing a reservation', async () => {
    const db = getDb();
    const suffix = randomUUID().replaceAll('-', '');
    const owner = 'legacy-a-' + suffix;
    const foreign = 'legacy-b-' + suffix;
    const code = 'L' + suffix.slice(0, 9).toUpperCase();
    tracked.push('users/' + owner, 'users/' + foreign,
      MEMBER_REFERRAL_CODE_REGISTRY + '/' + code);
    const batch = db.batch();
    batch.set(db.collection('users').doc(owner), { referralCode: code });
    batch.set(db.collection('users').doc(foreign), { referralCode: code });
    await batch.commit();
    await expect(reserveMemberReferralCode(db, owner, code))
      .resolves.toEqual({ status: 'conflict' });
    expect((await db.collection(MEMBER_REFERRAL_CODE_REGISTRY).doc(code).get()).exists)
      .toBe(false);
  }, 60_000);

  it('reserves a unique legacy code only for its owner and rejects tampered reservation', async () => {
    const db = getDb();
    const suffix = randomUUID().replaceAll('-', '');
    const uid = 'legacy-single-' + suffix;
    const code = 'S' + suffix.slice(0, 9).toUpperCase();
    tracked.push('users/' + uid, MEMBER_REFERRAL_CODE_REGISTRY + '/' + code);
    await db.collection('users').doc(uid).set({ referralCode: code, isVerified: false });
    await expect(reserveMemberReferralCode(db, uid, code))
      .resolves.toEqual({ status: 'created' });
    await expect(reserveMemberReferralCode(db, uid, code))
      .resolves.toEqual({ status: 'already_owned' });
    await db.collection(MEMBER_REFERRAL_CODE_REGISTRY).doc(code).update({ status: 'revoked' });
    await expect(reserveMemberReferralCode(db, uid, code))
      .resolves.toEqual({ status: 'conflict' });
  }, 60_000);

  it('rejects pending deletion and missing accounts before any registry mutation', async () => {
    const db = getDb();
    const suffix = randomUUID().replaceAll('-', '');
    const uid = 'deleting-' + suffix;
    const absentUid = 'not-created-' + suffix;
    const code = 'D' + suffix.slice(0, 9).toUpperCase();
    tracked.push('users/' + uid, 'account_deletions/' + uid,
      MEMBER_REFERRAL_CODE_REGISTRY + '/' + code);
    await db.collection('users').doc(uid).set({ isAdult: true });
    await db.collection('account_deletions').doc(uid).set({ requestedAt: new Date() });
    await expect(reserveMemberReferralCode(db, uid, code))
      .resolves.toEqual({ status: 'account_unavailable' });
    await expect(reserveMemberReferralCode(db, absentUid, code))
      .resolves.toEqual({ status: 'account_unavailable' });
    expect((await db.collection(MEMBER_REFERRAL_CODE_REGISTRY).doc(code).get()).exists)
      .toBe(false);
  }, 60_000);

  it('rejects invalid code / UID before Firestore access', async () => {
    const db = getDb();
    await expect(reserveMemberReferralCode(db, 'x/y', 'ABCDEFGHIJ'))
      .resolves.toEqual({ status: 'conflict' });
    await expect(reserveMemberReferralCode(db, 'some-uid', 'INVALID!'))
      .resolves.toEqual({ status: 'conflict' });
  });
});
