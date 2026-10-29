// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { getDb } from '../src/server/db';
import { recordPartnerConversion } from '../src/server/partnerReferralService';
import {
  derivePartnerReferralToken, partnerReferralDocumentId,
  partnerWebhookEventDocumentId, partnerBuyerClaimDocumentId,
} from '../src/server/partnerReferralCore';

const profile = JSON.parse(readFileSync('firebase.pruefung.json', 'utf8'));
const match = /^(localhost|127\.0\.0\.1|\[::1\]):([0-9]{1,5})$/.exec(process.env.FIRESTORE_EMULATOR_HOST ?? '');
const projects = [process.env.GCLOUD_PROJECT, process.env.GOOGLE_CLOUD_PROJECT, process.env.FIREBASE_PROJECT_ID].filter(Boolean);
const dedicatedEmulatorRun = process.env.KLAR_RUN_PARTNER_CONVERSION_EMULATOR === '1';
if (dedicatedEmulatorRun) {
  if (process.env.KLAR_REQUIRE_FIRESTORE_EMULATOR !== '1'
    || !match || Number(match[2]) !== profile.emulators.firestore.port
    || projects.some(id => id !== 'demo-klar') || process.env.NODE_ENV === 'production'
    || process.env.KLAR_ALLOW_DURABLE_DB_FALLBACK === 'true') {
    throw new Error('partner_conversion_emulator_unsafe_target');
  }
}

describe.skipIf(!dedicatedEmulatorRun)('partner conversion concurrency with real Firestore emulator', () => {
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
    const ownerRef = db.collection('users').doc(ownerUid);
    const buyerRef = db.collection('users').doc(buyerUid);
    const campaignRef = db.collection('partner_campaigns').doc(campaignId);
    const referralRef = db.collection('partner_referrals').doc(partnerReferralDocumentId(token));
    const eventRef = db.collection('partner_referral_conversions')
      .doc(partnerWebhookEventDocumentId(slug, payload.eventId, auditSecret));
    const secondEventRef = db.collection('partner_referral_conversions')
      .doc(partnerWebhookEventDocumentId(slug, payload.eventId + '-other', auditSecret));
    const buyerClaimRef = db.collection('partner_referral_buyer_claims')
      .doc(partnerBuyerClaimDocumentId(slug, buyerUid, auditSecret));
    const refs = [ownerRef, buyerRef, campaignRef, referralRef, eventRef, secondEventRef, buyerClaimRef] as const;
    try {
      await Promise.all([
        ownerRef.set({ isAdult: true, partnerReferralConsent: true, partnerReferralVersion: 1 }),
        buyerRef.set({ isAdult: true, partnerReferralConsent: true, partnerReferralVersion: 1 }),
        campaignRef.set({ status: 'active', slug, brandVerified: true, rewardLabel: 'Klar+ time' }),
        referralRef.set({ ownerUid, campaignId, version: 1, status: 'active' }),
      ]);
      const deps = { getFirestore: () => db, tokenSecret: () => tokenSecret,
        auditSecret: () => auditSecret, publicUrl: () => 'https://klar.example' };
      const results = await Promise.all(Array.from({ length: 4 },
        () => recordPartnerConversion(deps, slug, payload, partnerSecret)));
      expect(results.filter(v => v.duplicate === false)).toHaveLength(1);
      expect(results.filter(v => v.duplicate === true)).toHaveLength(3);
      expect(results.every(v => v.ok)).toBe(true);
      expect((await campaignRef.get()).data()?.qualifiedConversions ?? 0).toBe(0);
      expect((await referralRef.get()).data()?.qualifiedConversions ?? 0).toBe(0);
      const event = (await eventRef.get()).data();
      const claim = (await buyerClaimRef.get()).data();
      expect(event).toMatchObject({
        campaignId, referralId: referralRef.id, proofStatus: 'partner_assertion_only',
        rewardStatus: 'pending_verification', buyerConsentVersion: 1,
      });
      expect(claim).toMatchObject({
        campaignId, referralId: referralRef.id, conversionId: eventRef.id,
        buyerConsentVersion: 1, createdAt: event?.createdAt,
      });
      expect(event?.buyerUid).toBeUndefined();
      expect(claim?.buyerUid).toBeUndefined();
      // A new event ID for the same buyer/campaign must not bypass the buyer claim.
      await expect(recordPartnerConversion(deps, slug,
        { ...payload, eventId: payload.eventId + '-other' }, partnerSecret))
        .rejects.toMatchObject({ code: 'duplicate_conversion' });
      expect((await secondEventRef.get()).exists).toBe(false);
      const otherBuyerUid = 'race-other-' + suffix;
      const otherRef = db.collection('users').doc(otherBuyerUid);
      await otherRef.set({ isAdult: true, partnerReferralConsent: true, partnerReferralVersion: 1 });
      try {
        await expect(recordPartnerConversion(deps, slug, { ...payload, buyerUid: otherBuyerUid }, partnerSecret))
          .rejects.toMatchObject({ code: 'partner_event_id_conflict' });
      } finally { await otherRef.delete(); }
    } finally {
      // The emulator project is disposable; delete only test-owned documents.
      // The service appends an audit record on the successful transaction.
      // Avoid leaving test-owned audit data behind between emulator runs.
      const ledger = await db.collection('partner_referral_ledger')
        .where('campaignId', '==', campaignId).get();
      await Promise.all([...refs.map(ref => ref.delete()), ...ledger.docs.map(doc => doc.ref.delete())]);
    }
  }, 120_000);
});
