// @vitest-environment node
import { afterEach, describe, expect, it } from 'vitest';
import { createHash, randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { AddressInfo } from 'node:net';
import express from 'express';
import { FieldValue } from 'firebase-admin/firestore';
import { getDb } from '../src/server/db';
import { createLaunchRouter, type LaunchRouterDeps } from '../src/server/routes/launch';

const host = process.env.FIRESTORE_EMULATOR_HOST ?? '';
if (host || process.env.KLAR_REQUIRE_FIRESTORE_EMULATOR === '1') {
  const configFile = process.env.KLAR_REQUIRE_FIRESTORE_EMULATOR === '1'
    ? 'firebase.pruefung.json' : 'firebase.json';
  const config = JSON.parse(readFileSync(resolve(process.cwd(), configFile), 'utf8'));
  const local = /^(localhost|127\.0\.0\.1|\[::1\]):([0-9]{1,5})$/.exec(host);
  const ids = [process.env.GCLOUD_PROJECT, process.env.GOOGLE_CLOUD_PROJECT, process.env.FIREBASE_PROJECT_ID].filter(Boolean);
  if (!local || Number(local[2]) !== config?.emulators?.firestore?.port
    || ids.some(id => id !== 'demo-klar')
    || process.env.KLAR_ALLOW_DURABLE_DB_FALLBACK === 'true'
    || process.env.NODE_ENV === 'production') {
    throw new Error('member_referral_firestore_emulator_unsafe_target');
  }
}

describe.skipIf(!host)('member referral attribution on real Firestore emulator', () => {
  const paths: string[] = [];
  const servers: Array<ReturnType<ReturnType<typeof express>['listen']>> = [];
  afterEach(async () => {
    await Promise.all(servers.splice(0).map(server => new Promise<void>(resolve => server.close(() => resolve()))));
    const db = getDb();
    await Promise.all(paths.splice(0).map(path => db.doc(path).delete()));
  });

  it('makes only the original inviter retry idempotent and denies conflicting claims', async () => {
    const db = getDb();
    const suffix = randomUUID().replace(/-/g, '');
    const inviteeUid = 'ref-claim-' + suffix;
    const inviterA = 'ref-owner-a-' + suffix;
    const inviterB = 'ref-owner-b-' + suffix;
    // Unique per test so another emulator suite cannot claim our inviter code.
    const codeA = suffix.slice(0, 10).toUpperCase();
    const codeB = suffix.slice(10, 20).toUpperCase();
    const inviteeRef = db.collection('users').doc(inviteeUid);
    const inviterARef = db.collection('users').doc(inviterA);
    const inviterBRef = db.collection('users').doc(inviterB);
    const eventA = db.collection('referral_events').doc(inviterA + '_' + inviteeUid);
    const eventB = db.collection('referral_events').doc(inviterB + '_' + inviteeUid);
    const rateKey = createHash('sha256')
      .update('klar-rate-limit:rate_limit_launch_referral_claim:uid:' + inviteeUid, 'utf8').digest('hex');
    const limitRef = db.collection('rate_limit_launch_referral_claim').doc(rateKey);
    paths.push(inviteeRef.path, inviterARef.path, inviterBRef.path, eventA.path, eventB.path, limitRef.path);
    await Promise.all([
      inviteeRef.create({ isAdult: true, isVerified: false }),
      inviterARef.create({ isAdult: true, referralCode: codeA }),
      inviterBRef.create({ isAdult: true, referralCode: codeB }),
    ]);

    const deps: LaunchRouterDeps = {
      currentUserId: () => inviteeUid,
      getFirestore: () => db,
      normalizeLaunchCity: () => null,
      getLocalDensity: async () => ({ city: '', activeUsers: 0, verifiedUsers: 0, band: '', threshold: 0 }),
      referralCodeFor: () => 'ABCDEFGHIJ',
      recordActivation: async () => undefined,
      activationScore: () => ({ score: 0, activated: false }),
      serverTimestamp: () => FieldValue.serverTimestamp(),
      publicUrl: () => 'https://klar.example',
    };
    const app = express();
    app.use('/api', createLaunchRouter(deps));
    const server = app.listen(0, '127.0.0.1');
    servers.push(server);
    await new Promise<void>(resolve => server.once('listening', resolve));
    const url = 'http://127.0.0.1:' + (server.address() as AddressInfo).port + '/api/referral/claim';
    const claim = async (code: string) => {
      const response = await fetch(url, {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ code }),
      });
      return response.status;
    };

    // Competing *initial* claims race on the same invitee document. Exactly
    // one may establish attribution, regardless of transaction retry order.
    const firstClaims = await Promise.all([claim(codeA), claim(codeB)]);
    expect([...firstClaims].sort()).toEqual([200, 409]);
    const winner = firstClaims[0] === 200 ? { uid: inviterA, code: codeA, event: eventA }
      : { uid: inviterB, code: codeB, event: eventB };
    const loser = firstClaims[0] === 200 ? { code: codeB, event: eventB }
      : { code: codeA, event: eventA };
    const retries = await Promise.all([claim(winner.code), claim(loser.code)]);
    expect(retries).toEqual([200, 409]);
    expect((await inviteeRef.get()).data()).toMatchObject({ referredBy: winner.uid, referralQualified: false, isVerified: false });
    expect((await winner.event.get()).data()).toMatchObject({ inviterUid: winner.uid, inviteeUid, status: 'attributed' });
    expect((await loser.event.get()).exists).toBe(false);
  }, 90_000);
});
