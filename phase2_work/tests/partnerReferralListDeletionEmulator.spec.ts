// @vitest-environment node
import { afterEach, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { getDb } from '../src/server/db';
import { listPartnerReferralLinks } from '../src/server/partnerReferralService';

// In tests requiring Firestore, reject every non-local target BEFORE getDb().
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
    throw new Error('partner_list_firestore_emulator_unsafe_target');
  }
}

describe.skipIf(!host)('partner referral list / Art.17 marker (real Firestore emulator)', () => {
  const paths: string[] = [];
  afterEach(async () => {
    const db = getDb();
    await Promise.all(paths.splice(0).map(path => db.doc(path).delete()));
  });

  it('blocks even an empty campaign overview while an account deletion marker exists', async () => {
    const db = getDb();
    const uid = 'partner-list-' + randomUUID();
    const user = db.collection('users').doc(uid);
    const deletion = db.collection('account_deletions').doc(uid);
    paths.push(user.path, deletion.path);
    await user.create({ isAdult: true, partnerReferralConsent: true, partnerReferralVersion: 1 });
    await deletion.create({ status: 'pending' });
    const deps = {
      getFirestore: () => db,
      tokenSecret: () => 'integration-referral-secret-at-least-32-chars',
      auditSecret: () => 'integration-referral-audit-at-least-32-chars',
      publicUrl: () => undefined,
    };
    await expect(listPartnerReferralLinks(deps, uid)).rejects.toMatchObject({
      status: 409, code: 'partner_account_deleting',
    });
    expect((await db.collection('partner_referrals').where('ownerUid', '==', uid).get()).empty).toBe(true);
  }, 90_000);

  it('returns an empty authorized list when there is no deletion marker or campaign', async () => {
    const db = getDb();
    const uid = 'partner-list-' + randomUUID();
    const user = db.collection('users').doc(uid);
    paths.push(user.path);
    await user.create({ isAdult: true, partnerReferralConsent: true, partnerReferralVersion: 1 });
    const result = await listPartnerReferralLinks({
      getFirestore: () => db,
      tokenSecret: () => 'integration-referral-secret-at-least-32-chars',
      auditSecret: () => 'integration-referral-audit-at-least-32-chars',
      publicUrl: () => undefined,
    }, uid);
    expect(result).toEqual({ consent: { allowed: true }, referrals: [] });
  }, 90_000);
});
