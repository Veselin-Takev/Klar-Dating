// @vitest-environment node
import { afterEach, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { getDb } from '../src/server/db';
import { getPartnerConsentState } from '../src/server/partnerReferralService';

// Never construct an Admin SDK client unless Firestore points at our local demo emulator.
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
    throw new Error('partner_consent_firestore_emulator_unsafe_target');
  }
}

describe.skipIf(!host)('partner consent / account deletion marker (Firestore emulator)', () => {
  const paths: string[] = [];
  afterEach(async () => {
    const db = getDb();
    await Promise.all(paths.splice(0).map(path => db.doc(path).delete()));
  });

  it('denies a previously granted consent once deletion is pending', async () => {
    const db = getDb();
    const uid = 'partner-consent-' + randomUUID();
    const user = db.collection('users').doc(uid);
    const deletion = db.collection('account_deletions').doc(uid);
    paths.push(user.path, deletion.path);
    await user.create({ isAdult: true, partnerReferralConsent: true, partnerReferralVersion: 1 });
    await deletion.create({ status: 'pending' });
    expect(await getPartnerConsentState({ getFirestore: () => db } as any, uid)).toEqual({ allowed: false });
  }, 90_000);

  it('preserves an eligible grant before deletion and denies it afterward', async () => {
    const db = getDb();
    const uid = 'partner-consent-' + randomUUID();
    const user = db.collection('users').doc(uid);
    const deletion = db.collection('account_deletions').doc(uid);
    paths.push(user.path, deletion.path);
    await user.create({ isAdult: true, partnerReferralConsent: true, partnerReferralVersion: 1 });
    const deps = { getFirestore: () => db } as any;
    expect(await getPartnerConsentState(deps, uid)).toEqual({ allowed: true });
    await deletion.create({ status: 'pending' });
    expect(await getPartnerConsentState(deps, uid)).toEqual({ allowed: false });
    expect((await user.get()).data()?.partnerReferralConsent).toBe(true);
  }, 90_000);
});
