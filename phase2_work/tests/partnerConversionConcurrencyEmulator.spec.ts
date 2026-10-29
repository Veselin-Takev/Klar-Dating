// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { getDb } from '../src/server/db';
import { recordPartnerConversion } from '../src/server/partnerReferralService';
import { derivePartnerReferralToken, partnerReferralDocumentId } from '../src/server/partnerReferralCore';

const profile = JSON.parse(readFileSync('firebase.pruefung.json', 'utf8'));
const match = /^(localhost|127\.0\.0\.1|\[::1\]):([0-9]{1,5})$/.exec(process.env.FIRESTORE_EMULATOR_HOST ?? '');
const projects = [process.env.GCLOUD_PROJECT, process.env.GOOGLE_CLOUD_PROJECT, process.env.FIREBASE_PROJECT_ID].filter(Boolean);
if (process.env.KLAR_REQUIRE_FIRESTORE_EMULATOR === '1' || process.env.FIRESTORE_EMULATOR_HOST) {
  if (!match || Number(match[2]) !== profile.emulators.firestore.port
    || projects.some(id => id !== 'demo-klar') || process.env.NODE_ENV === 'production'
    || process.env.KLAR_ALLOW_DURABLE_DB_FALLBACK === 'true') {
    throw new Error('partner_conversion_emulator_unsafe_target');
  }
}

describe.skipIf(!process.env.FIRESTORE_EMULATOR_HOST)('partner conversion concurrency with real Firestore emulator', () => {
  it('commits one provider assertion under concurrent replay, without crediting rewards', async () => {
    const db = getDb();
    const suffix = randomUUID().replace(/-/g, '');
    const campaignId = 'race-campaign-' + suffix;
    const slug = 'race-' + suffix.slice(0, 20);
    const ownerUid = 'race-owner-' + suffix;
    const buyerUid = 'race-buyer-' + suffix;
    const tokenSecret = 'partner-test-referral-secret-at-least-32-characters';
    const auditSecret = 'partner-test-audit-secret-at-least-32-characters';
    const partnerSecret = 'partner-provider-test-secret-at-least-32-characters';
    const token = derivePartnerReferralToken(ownerUid, campaignId, 1, tokenSecret);
    const payload = { event: 'qualified_conversion' as const, eventId: 'event-' + suffix, referralToken: token, buyerUid };
    const refs = [
      db.collection('users').doc(ownerUid),
      db.collection('users').doc(buyerUid),
      db.collection('partner_campaigns').doc(campaignId),
      db.collection('partner_referrals').doc(partnerReferralDocumentId(token)),
    ];
    try {
      await Promise.all([
        refs[0].set({ isAdult: true, partnerReferralConsent: true, partnerReferralVersion: 1 }),
        refs[1].set({ isAdult: true, partnerReferralConsent: true, partnerReferralVersion: 1 }),
        refs[2].set({ status: 'active', slug, brandVerified: true, rewardLabel: 'Klar+ time' }),
        refs[3].set({ ownerUid, campaignId, version: 1, status: 'active' }),
      ]);
      const deps = { getFirestore: () => db, tokenSecret: () => tokenSecret,
        auditSecret: () => auditSecret, publicUrl: () => 'https://klar.example' };
      const results = await Promise.all(Array.from({ length: 4 },
        () => recordPartnerConversion(deps, slug, payload, partnerSecret)));
      expect(results.filter(v => v.duplicate === false)).toHaveLength(1);
      expect(results.filter(v => v.duplicate === true)).toHaveLength(3);
      expect(results.every(v => v.ok)).toBe(true);
      expect((await refs[2].get()).data()?.qualifiedConversions ?? 0).toBe(0);
      const otherBuyerUid = 'race-other-' + suffix;
      const otherRef = db.collection('users').doc(otherBuyerUid);
      await otherRef.set({ isAdult: true, partnerReferralConsent: true, partnerReferralVersion: 1 });
      try {
        await expect(recordPartnerConversion(deps, slug, { ...payload, buyerUid: otherBuyerUid }, partnerSecret))
          .rejects.toMatchObject({ code: 'partner_event_id_conflict' });
      } finally { await otherRef.delete(); }
    } finally {
      // The emulator project is disposable; delete only test-owned documents.
      await Promise.all(refs.map(ref => ref.delete()));
    }
  }, 120_000);
});
