// @vitest-environment node
// P0 #55: real Firestore emulator, never a deployed database.
import { afterEach, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { getDb } from '../src/server/db';
import {
  derivePartnerReferralToken, partnerReferralDocumentId,
  partnerWebhookEventDocumentId, partnerBuyerClaimDocumentId,
} from '../src/server/partnerReferralCore';
import { recordPartnerConversion } from '../src/server/partnerReferralService';

const host = process.env.FIRESTORE_EMULATOR_HOST ?? '';
if (host || process.env.KLAR_REQUIRE_FIRESTORE_EMULATOR === '1') {
  const config = JSON.parse(readFileSync(process.env.KLAR_REQUIRE_FIRESTORE_EMULATOR === '1'
    ? 'firebase.pruefung.json' : 'firebase.json', 'utf8'));
  const address = /^(localhost|127[.]0[.]0[.]1|\[::1\]):([0-9]{1,5})$/.exec(host);
  const projects = [process.env.GCLOUD_PROJECT, process.env.GOOGLE_CLOUD_PROJECT,
    process.env.FIREBASE_PROJECT_ID].filter(Boolean);
  if (!address || Number(address[2]) !== config?.emulators?.firestore?.port
    || projects.some(project => project !== 'demo-klar')
    || process.env.NODE_ENV === 'production'
    || process.env.KLAR_ALLOW_DURABLE_DB_FALLBACK === 'true') {
    throw new Error('partner_conversion_emulator_unsafe_target');
  }
}
const tokenSecret = 'emulator-partner-token-secret-32-bytes-or-more';
const auditSecret = 'emulator-partner-ledger-secret-32-bytes-or-more';
const providerSecret = 'emulator-partner-provider-secret-32-bytes-or-more';
const trackedPaths: string[] = [];
const trackedCampaigns: string[] = [];
const deps = () => ({
  getFirestore: () => getDb(),
  tokenSecret: () => tokenSecret,
  auditSecret: () => auditSecret,
  publicUrl: () => 'https://klar.example',
});
afterEach(async () => {
  if (!host) return;
  const db = getDb();
  // Only delete synthetic fixtures of this run; never touch other test data.
  for (const campaignId of trackedCampaigns.splice(0)) {
    const ledger = await db.collection('partner_referral_ledger').where('campaignId', '==', campaignId).get();
    await Promise.all(ledger.docs.map(doc => doc.ref.delete()));
  }
  await Promise.all(trackedPaths.splice(0).map(path => db.doc(path).delete()));
});

describe.skipIf(!host)('partner provider assertions / replay (real Firestore emulator)', () => {
  it('serializes parallel callbacks, rejects forged buyer replay and never credits an unverified purchase', async () => {
    const db = getDb();
    const suffix = randomUUID().replaceAll('-', '');
    const ownerUid = 'owner-' + suffix;
    const buyerUid = 'buyer-' + suffix;
    const otherBuyerUid = 'other-buyer-' + suffix;
    const campaignId = 'campaign-' + suffix;
    const slug = 'partner-' + suffix.slice(0, 12);
    const token = derivePartnerReferralToken(ownerUid, campaignId, 1, tokenSecret);
    const referralId = partnerReferralDocumentId(token);
    const eventId = 'provider-order-' + suffix;
    const payload = { event: 'qualified_conversion' as const, eventId, referralToken: token, buyerUid };
    const eventHash = partnerWebhookEventDocumentId(slug, eventId, auditSecret);
    const buyerClaimHash = partnerBuyerClaimDocumentId(slug, buyerUid, auditSecret);
    trackedCampaigns.push(campaignId);
    const fixtures = [
      { path: 'users/' + ownerUid, data: { isAdult: true, partnerReferralConsent: true, partnerReferralVersion: 1 } },
      { path: 'users/' + buyerUid, data: { isAdult: true, partnerReferralConsent: true, partnerReferralVersion: 1 } },
      { path: 'users/' + otherBuyerUid, data: { isAdult: true, partnerReferralConsent: true, partnerReferralVersion: 1 } },
      { path: 'partner_campaigns/' + campaignId,
        data: { slug, status: 'active', brandVerified: true, deletedAt: null, rewardLabel: 'Klar+ Zeit' } },
      { path: 'partner_referrals/' + referralId,
        data: { ownerUid, campaignId, version: 1, status: 'active' } },
    ];
    trackedPaths.push(...fixtures.map(f => f.path),
      'partner_referral_conversions/' + eventHash,
      'partner_referral_buyer_claims/' + buyerClaimHash);
    const batch = db.batch();
    for (const fixture of fixtures) batch.set(db.doc(fixture.path), fixture.data);
    await batch.commit();

    const pair = await Promise.all([
      recordPartnerConversion(deps(), slug, payload, providerSecret),
      recordPartnerConversion(deps(), slug, payload, providerSecret),
    ]);
    expect(pair.filter(result => !result.duplicate)).toHaveLength(1);
    expect(pair.filter(result => result.duplicate)).toHaveLength(1);
    expect(pair.every(result => result.rewardStatus === 'pending_verification'
      || result.rewardStatus === 'already_recorded')).toBe(true);

    // Ten provider retries must not create an additional conversion, claim or earned reward.
    for (let i = 0; i < 10; i++) {
      await expect(recordPartnerConversion(deps(), slug, payload, providerSecret))
        .resolves.toMatchObject({ duplicate: true, rewardStatus: 'already_recorded' });
    }
    const eventRef = db.collection('partner_referral_conversions').doc(eventHash);
    const claimRef = db.collection('partner_referral_buyer_claims').doc(buyerClaimHash);
    expect((await eventRef.get()).data()).toMatchObject({
      rewardStatus: 'pending_verification', proofStatus: 'partner_assertion_only',
      buyerConsentVersion: 1,
    });
    expect((await claimRef.get()).data()).toMatchObject({
      conversionId: eventHash, buyerConsentVersion: 1,
    });

    await expect(recordPartnerConversion(deps(), slug,
      { ...payload, buyerUid: otherBuyerUid }, providerSecret))
      .rejects.toMatchObject({ code: 'partner_event_id_conflict' });

    await db.collection('users').doc(buyerUid).update({ partnerReferralConsent: false });
    await expect(recordPartnerConversion(deps(), slug, payload, providerSecret))
      .rejects.toMatchObject({ code: 'conversion_not_eligible' });

    const ledger = await db.collection('partner_referral_ledger')
      .where('campaignId', '==', campaignId).get();
    expect(ledger.docs.filter(doc => doc.data().eventType === 'partner_conversion_asserted')).toHaveLength(1);
    expect(ledger.docs.some(doc => doc.data().eventType === 'partner_conversion_verified')).toBe(false);
    expect((await eventRef.get()).data()?.rewardStatus).toBe('pending_verification');
  }, 120_000);
  it('serializes different provider events racing for one buyer claim', async () => {
    const db = getDb();
    const suffix = randomUUID().replaceAll('-', '');
    const ownerUid = 'owner-race-' + suffix;
    const buyerUid = 'buyer-race-' + suffix;
    const campaignId = 'campaign-race-' + suffix;
    const slug = 'race-' + suffix.slice(0, 12);
    const referralToken = derivePartnerReferralToken(ownerUid, campaignId, 1, tokenSecret);
    const referralId = partnerReferralDocumentId(referralToken);
    const eventIds = ['provider-order-a-' + suffix, 'provider-order-b-' + suffix];
    const eventHashes = eventIds.map(id => partnerWebhookEventDocumentId(slug, id, auditSecret));
    const claimId = partnerBuyerClaimDocumentId(slug, buyerUid, auditSecret);
    trackedCampaigns.push(campaignId);
    const fixtures = [
      { path: 'users/' + ownerUid, data: { isAdult: true, partnerReferralConsent: true, partnerReferralVersion: 1 } },
      { path: 'users/' + buyerUid, data: { isAdult: true, partnerReferralConsent: true, partnerReferralVersion: 1 } },
      { path: 'partner_campaigns/' + campaignId,
        data: { slug, status: 'active', brandVerified: true, deletedAt: null, rewardLabel: 'Klar+ Zeit' } },
      { path: 'partner_referrals/' + referralId,
        data: { ownerUid, campaignId, version: 1, status: 'active' } },
    ];
    trackedPaths.push(...fixtures.map(fixture => fixture.path),
      ...eventHashes.map(id => 'partner_referral_conversions/' + id),
      'partner_referral_buyer_claims/' + claimId);
    const batch = db.batch();
    for (const fixture of fixtures) batch.set(db.doc(fixture.path), fixture.data);
    await batch.commit();

    // These are different, correctly formed assertions. Only one buyer claim
    // may exist even when both event IDs are new and sent concurrently.
    const results = await Promise.allSettled(eventIds.map(eventId =>
      recordPartnerConversion(deps(), slug, {
        event: 'qualified_conversion', eventId, referralToken, buyerUid,
      }, providerSecret)));
    expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter(result => result.status === 'rejected')).toHaveLength(1);
    for (const result of results) {
      if (result.status === 'fulfilled') {
        expect(result.value).toMatchObject({ duplicate: false, rewardStatus: 'pending_verification' });
      } else {
        expect(result.reason).toMatchObject({ code: 'duplicate_conversion' });
      }
    }

    const storedEvents = await Promise.all(eventHashes.map(id =>
      db.collection('partner_referral_conversions').doc(id).get()));
    expect(storedEvents.filter(snapshot => snapshot.exists)).toHaveLength(1);
    const claim = await db.collection('partner_referral_buyer_claims').doc(claimId).get();
    expect(claim.exists).toBe(true);
    expect(eventHashes).toContain(claim.data()?.conversionId);
    expect(storedEvents.filter(snapshot => snapshot.exists)[0]?.data())
      .toMatchObject({ rewardStatus: 'pending_verification', proofStatus: 'partner_assertion_only' });
    const ledger = await db.collection('partner_referral_ledger').where('campaignId', '==', campaignId).get();
    expect(ledger.docs.filter(doc => doc.data().eventType === 'partner_conversion_asserted')).toHaveLength(1);
    expect(ledger.docs.some(doc => doc.data().eventType === 'partner_conversion_verified')).toBe(false);
  }, 120_000);

});
