// @vitest-environment node
// P0 #48: real local Firestore emulator; no live Firebase traffic.
import { describe, expect, it } from 'vitest';
import express from 'express';
import { createHash, randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import type { AddressInfo } from 'node:net';
import { getDb } from '../src/server/db';
import { createLaunchRouter } from '../src/server/routes/launch';

// Fail closed even when this file is run directly rather than by the CI wrapper.
const host = process.env.FIRESTORE_EMULATOR_HOST ?? '';
if (host || process.env.KLAR_REQUIRE_FIRESTORE_EMULATOR === '1') {
  const file = process.env.KLAR_REQUIRE_FIRESTORE_EMULATOR === '1'
    ? 'firebase.pruefung.json' : 'firebase.json';
  const config = JSON.parse(readFileSync(file, 'utf8'));
  const local = /^(localhost|127[.]0[.]0[.]1|\[::1\]):([0-9]{1,5})$/.exec(host);
  const projectIds = [process.env.GCLOUD_PROJECT, process.env.GOOGLE_CLOUD_PROJECT,
    process.env.FIREBASE_PROJECT_ID].filter(Boolean);
  if (!local || Number(local[2]) !== config?.emulators?.firestore?.port
    || projectIds.some(id => id !== 'demo-klar')
    || process.env.NODE_ENV === 'production'
    || process.env.KLAR_ALLOW_DURABLE_DB_FALLBACK === 'true') {
    throw new Error('member_referral_firestore_emulator_unsafe_target');
  }
}

describe.skipIf(!host)('member referral competing claims (real Firestore emulator)', () => {
  it('serializes two different inviters for one invitee and never qualifies or rewards', async () => {
    const db = getDb();
    const suffix = randomUUID().replaceAll('-', '');
    const inviteeUid = 'member-invitee-' + suffix;
    const inviterA = 'member-inviter-a-' + suffix;
    const inviterB = 'member-inviter-b-' + suffix;
    const codeA = 'A1B2C3D4E5';
    const codeB = 'Z9Y8X7W6V5';
    const rateLimitKey = createHash('sha256')
      .update('klar-rate-limit:rate_limit_launch_referral_claim:uid:' + inviteeUid)
      .digest('hex');
    const paths = [
      'users/' + inviteeUid, 'users/' + inviterA, 'users/' + inviterB,
      'referral_events/' + inviterA + '_' + inviteeUid,
      'referral_events/' + inviterB + '_' + inviteeUid,
      'rate_limit_launch_referral_claim/' + rateLimitKey,
    ];
    let server: ReturnType<ReturnType<typeof express>['listen']> | undefined;
    try {
      const batch = db.batch();
      batch.set(db.collection('users').doc(inviteeUid), { isAdult: true, isVerified: false });
      batch.set(db.collection('users').doc(inviterA), { referralCode: codeA, isAdult: true });
      batch.set(db.collection('users').doc(inviterB), { referralCode: codeB, isAdult: true });
      await batch.commit();

      const app = express();
      // Synthetic authenticated context: tests the actual HTTP route/transaction,
      // NOT Firebase Admin token verification or a real token.
      app.use('/api', (req, _res, next) => {
        Object.assign(req, {
          user: { uid: inviteeUid, firebase: { identities: {}, sign_in_provider: 'password' } },
        });
        next();
      });
      app.use('/api', createLaunchRouter({
        currentUserId: () => inviteeUid,
        getFirestore: () => db,
        normalizeLaunchCity: () => 'München',
        getLocalDensity: async () => ({
          city: 'München', activeUsers: 0, verifiedUsers: 0, band: 'building', threshold: 5,
        }),
        referralCodeFor: () => codeA,
        recordActivation: async () => ({}),
        activationScore: () => ({ score: 0, activated: false }),
        serverTimestamp: () => new Date(),
        publicUrl: () => 'https://klar.example',
      }));
      server = app.listen(0, '127.0.0.1');
      await new Promise<void>(resolve => server!.once('listening', resolve));
      const origin = 'http://127.0.0.1:' + (server.address() as AddressInfo).port;
      const claim = (code: string) => fetch(origin + '/api/referral/claim', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ code }),
      });
      const [first, second] = await Promise.all([claim(codeA), claim(codeB)]);
      expect([first.status, second.status].sort()).toEqual([200, 409]);
      const winner = first.status === 200 ? inviterA : inviterB;
      const loser = winner === inviterA ? inviterB : inviterA;

      const invitee = (await db.collection('users').doc(inviteeUid).get()).data();
      expect(invitee).toMatchObject({
        referredBy: winner, referralQualified: false, isVerified: false,
      });
      const winnerEvent = await db.collection('referral_events').doc(winner + '_' + inviteeUid).get();
      const loserEvent = await db.collection('referral_events').doc(loser + '_' + inviteeUid).get();
      expect(winnerEvent.data()).toMatchObject({
        inviterUid: winner, inviteeUid, status: 'attributed',
      });
      expect(loserEvent.exists).toBe(false);

      // Retry the winner and the loser; only the original owner remains eligible.
      const sameCode = winner === inviterA ? codeA : codeB;
      const otherCode = winner === inviterA ? codeB : codeA;
      expect((await claim(sameCode)).status).toBe(200);
      expect((await claim(otherCode)).status).toBe(409);
      expect((await db.collection('referral_events').doc(loser + '_' + inviteeUid).get()).exists).toBe(false);
      expect((await db.collection('users').doc(inviteeUid).get()).data()).toMatchObject({
        referredBy: winner, referralQualified: false, isVerified: false,
      });
    } finally {
      if (server) await new Promise<void>(resolve => server!.close(() => resolve()));
      // Synthetic UID-suffixed resources only; avoid deleting any other test's data.
      await Promise.all(paths.map(path => db.doc(path).delete()));
    }
  }, 120_000);
  it('denies duplicate inviter codes from real Firestore without choosing an arbitrary owner', async () => {
    const db = getDb();
    const suffix = randomUUID().replaceAll('-', '');
    const inviteeUid = 'ambiguous-invitee-' + suffix;
    const inviterA = 'ambiguous-owner-a-' + suffix;
    const inviterB = 'ambiguous-owner-b-' + suffix;
    const code = 'C0LL1S10N9';
    const rateLimitKey = createHash('sha256')
      .update('klar-rate-limit:rate_limit_launch_referral_claim:uid:' + inviteeUid)
      .digest('hex');
    const paths = [
      'users/' + inviteeUid, 'users/' + inviterA, 'users/' + inviterB,
      'referral_events/' + inviterA + '_' + inviteeUid,
      'referral_events/' + inviterB + '_' + inviteeUid,
      'rate_limit_launch_referral_claim/' + rateLimitKey,
    ];
    let server: ReturnType<ReturnType<typeof express>['listen']> | undefined;
    try {
      const batch = db.batch();
      batch.set(db.collection('users').doc(inviteeUid), { isAdult: true, isVerified: false });
      batch.set(db.collection('users').doc(inviterA), { referralCode: code, isAdult: true });
      batch.set(db.collection('users').doc(inviterB), { referralCode: code, isAdult: true });
      await batch.commit();

      const app = express();
      app.use('/api', (req, _res, next) => {
        Object.assign(req, {
          user: { uid: inviteeUid, firebase: { identities: {}, sign_in_provider: 'password' } },
        });
        next();
      });
      app.use('/api', createLaunchRouter({
        currentUserId: () => inviteeUid,
        getFirestore: () => db,
        normalizeLaunchCity: () => 'München',
        getLocalDensity: async () => ({
          city: 'München', activeUsers: 0, verifiedUsers: 0, band: 'building', threshold: 5,
        }),
        referralCodeFor: () => code,
        recordActivation: async () => ({}),
        activationScore: () => ({ score: 0, activated: false }),
        serverTimestamp: () => new Date(),
        publicUrl: () => 'https://klar.example',
      }));
      server = app.listen(0, '127.0.0.1');
      await new Promise<void>(resolve => server!.once('listening', resolve));
      const origin = 'http://127.0.0.1:' + (server.address() as AddressInfo).port;
      const response = await fetch(origin + '/api/referral/claim', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ code }),
      });
      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({ error: 'Einladung nicht verfügbar.' });
      const invitee = (await db.collection('users').doc(inviteeUid).get()).data();
      expect(invitee?.referredBy).toBeUndefined();
      expect(invitee?.referralQualified).not.toBe(true);
      expect(invitee?.isVerified).toBe(false);
      for (const inviter of [inviterA, inviterB]) {
        expect((await db.collection('referral_events').doc(inviter + '_' + inviteeUid).get()).exists).toBe(false);
      }
    } finally {
      if (server) await new Promise<void>(resolve => server!.close(() => resolve()));
      await Promise.all(paths.map(path => db.doc(path).delete()));
    }
  }, 120_000);

  it('rejects issuing an already-owned code before changing an inviter profile', async () => {
    const db = getDb();
    const suffix = randomUUID().replaceAll('-', '');
    const caller = 'issuance-caller-' + suffix;
    const priorOwner = 'issuance-owner-' + suffix;
    const code = 'R3F3RRAL99';
    const key = createHash('sha256')
      .update('klar-rate-limit:rate_limit_launch_referral_generation:uid:' + caller)
      .digest('hex');
    const paths = [
      'users/' + caller, 'users/' + priorOwner,
      'rate_limit_launch_referral_generation/' + key,
    ];
    let server: ReturnType<ReturnType<typeof express>['listen']> | undefined;
    try {
      const batch = db.batch();
      batch.set(db.collection('users').doc(caller), { isAdult: true, isVerified: false });
      batch.set(db.collection('users').doc(priorOwner), {
        isAdult: true, referralCode: code,
      });
      await batch.commit();

      const app = express();
      app.use('/api', (req, _res, next) => {
        Object.assign(req, {
          user: { uid: caller, firebase: { identities: {}, sign_in_provider: 'password' } },
        });
        next();
      });
      app.use('/api', createLaunchRouter({
        currentUserId: () => caller,
        getFirestore: () => db,
        normalizeLaunchCity: () => 'München',
        getLocalDensity: async () => ({
          city: 'München', activeUsers: 0, verifiedUsers: 0, band: 'building', threshold: 5,
        }),
        referralCodeFor: () => code,
        recordActivation: async () => ({}),
        activationScore: () => ({ score: 0, activated: false }),
        serverTimestamp: () => new Date(),
        publicUrl: () => 'https://klar.example',
      }));
      server = app.listen(0, '127.0.0.1');
      await new Promise<void>(resolve => server!.once('listening', resolve));
      const address = 'http://127.0.0.1:' + (server.address() as AddressInfo).port;
      const result = await fetch(address + '/api/referral');
      expect(result.status).toBe(409);
      expect(await result.json()).toEqual({
        error: 'Einladung für dieses Konto derzeit nicht verfügbar.',
      });
      expect((await db.collection('users').doc(caller).get()).data()?.referralCode)
        .toBeUndefined();
      expect((await db.collection('users').doc(priorOwner).get()).data()?.referralCode)
        .toBe(code);
    } finally {
      if (server) await new Promise<void>(resolve => server!.close(() => resolve()));
      await Promise.all(paths.map(path => db.doc(path).delete()));
    }
  }, 120_000);

});
