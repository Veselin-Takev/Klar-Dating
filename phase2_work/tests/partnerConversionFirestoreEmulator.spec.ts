// @vitest-environment node
// P0 #55: actual Admin SDK transactions on a LOCAL Firestore Emulator.
// No cloud credentials, no durable proxy and no production-project target.
import { afterEach, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { getDb } from '../src/server/db';
import { recordPartnerConversion, type PartnerReferralServiceDeps } from '../src/server/partnerReferralService';
import {
  derivePartnerReferralToken, partnerReferralDocumentId,
  partnerBuyerClaimDocumentId, partnerWebhookEventDocumentId,
  type PartnerConversionPayload,
} from '../src/server/partnerReferralCore';

const activeHost = process.env.FIRESTORE_EMULATOR_HOST ?? '';
if (activeHost || process.env.KLAR_REQUIRE_FIRESTORE_EMULATOR === '1') {
  const match = /^(?:localhost|127\.0\.0\.1|\[::1\]):(\d{1,5})$/.exec(activeHost);
  const port = match ? Number(match[1]) : 0;
  const configFiles = ['firebase.json', 'firebase.pruefung.json'];
  const approvedPorts = configFiles.map(file => JSON.parse(readFileSync(resolve(process.cwd(), file), 'utf8'))
    ?.emulators?.firestore?.port);
  const projectIds = [
    process.env.GCLOUD_PROJECT, process.env.GOOGLE_CLOUD_PROJECT, process.env.FIREBASE_PROJECT_ID,
  ].filter(Boolean);
  if (!approvedPorts.includes(port) || port < 1 || port > 65535 ||
      projectIds.some(project => project !== 'demo-klar') ||
      process.env.NODE_ENV === 'production' ||
      process.env.KLAR_ALLOW_DURABLE_DB_FALLBACK === 'true') {
    throw new Error('partner_conversion_firestore_emulator_unsafe_target');
  }
}

const tokenSecret = 'emulator-partner-token-hmac-key-is-at-least-thirty-two';
const auditSecret = 'emulator-partner-audit-hmac-key-is-at-least-thirty-two';
const providerSecret = 'emulator-provider-hmac-key-is-at-least-thirty-two';
const slug = 'emulator-partner';
const activeFixtures: Array<{ campaignId: string; paths: string[] }> = [];

function makeTestDeps(): PartnerReferralServiceDeps {
  return {
    getFirestore: () => getDb(),
    tokenSecret: () => tokenSecret,
    auditSecret: () => auditSecret,
    publicUrl: () => 'https://klar.example',
  };
}

async function fixture() {
  const db = getDb();
  const suffix = randomUUID().replace(/-/g, '');
  const owner = 'owner_' + suffix;
  const buyer = 'buyer_' + suffix;
  const campaignId = 'campaign_' + suffix;
  const eventId = 'event-' + suffix;
  const token = derivePartnerReferralToken(owner, campaignId, 1, tokenSecret);
  const referralId = partnerReferralDocumentId(token);
  const paths = [
    'users/' + owner, 'users/' + buyer,
    'partner_campaigns/' + campaignId,
    'partner_referrals/' + referralId,
  ];
  // Register cleanup BEFORE the first write to prevent orphaned test data.
  activeFixtures.push({ campaignId, paths });
  const batch = db.batch();
  batch.set(db.doc(paths[0]!), {
    isAdult: true, partnerReferralConsent: true, partnerReferralVersion: 1,
  });
  batch.set(db.doc(paths[1]!), {
    isAdult: true, partnerReferralConsent: true, partnerReferralVersion: 1,
  });
  batch.set(db.doc(paths[2]!), {
    slug, status: 'active', brandVerified: true, deletedAt: null,
    rewardLabel: 'Nonpayable emulator test', qualifiedConversions: 0,
  });
  batch.set(db.doc(paths[3]!), {
    ownerUid: owner, campaignId, version: 1, status: 'active',
  });
  await batch.commit();
  const payload: PartnerConversionPayload = {
    event: 'qualified_conversion', eventId, referralToken: token, buyerUid: buyer,
  };
  const eventRef = db.collection('partner_referral_conversions')
    .doc(partnerWebhookEventDocumentId(slug, eventId, auditSecret));
  const claimRef = db.collection('partner_referral_buyer_claims')
    .doc(partnerBuyerClaimDocumentId(slug, buyer, auditSecret));
  return { db, owner, buyer, campaignId, payload, eventRef, claimRef, paths };
}

async function checkEvidence(testCase: Awaited<ReturnType<typeof fixture>>) {
  const { db, campaignId, eventRef, claimRef } = testCase;
  const [event, claim, ledger, campaign] = await Promise.all([
    eventRef.get(), claimRef.get(),
    db.collection('partner_referral_ledger').where('campaignId', '==', campaignId).get(),
    db.collection('partner_campaigns').doc(campaignId).get(),
  ]);
  expect(event.exists).toBe(true);
  expect(claim.exists).toBe(true);
  expect(event.data()).toMatchObject({
    rewardStatus: 'pending_verification', proofStatus: 'partner_assertion_only',
    campaignId,
  });
  expect(claim.data()).toMatchObject({ conversionId: eventRef.id, campaignId });
  expect(ledger.size).toBe(1);
  expect(campaign.data()?.qualifiedConversions).toBe(0);
  return { ledger };
}

afterEach(async () => {
  if (!activeHost) return;
  const db = getDb();
  for (const item of activeFixtures.splice(0)) {
    // Every test uses unique IDs; never reset shared emulator databases.
    const [conversion, claim, ledger] = await Promise.all([
      db.collection('partner_referral_conversions').where('campaignId', '==', item.campaignId).get(),
      db.collection('partner_referral_buyer_claims').where('campaignId', '==', item.campaignId).get(),
      db.collection('partner_referral_ledger').where('campaignId', '==', item.campaignId).get(),
    ]);
    const batch = db.batch();
    [...conversion.docs, ...claim.docs, ...ledger.docs].forEach(doc => batch.delete(doc.ref));
    item.paths.forEach(path => batch.delete(db.doc(path)));
    await batch.commit();
  }
});

describe.skipIf(!activeHost)('P0 #55 partner conversion native Firestore concurrency (emulator)', () => {
  it('serializes simultaneous retries of one event into one nonpayable assertion', async () => {
    const testCase = await fixture();
    const attempts = await Promise.all([
      recordPartnerConversion(makeTestDeps(), slug, testCase.payload, providerSecret),
      recordPartnerConversion(makeTestDeps(), slug, testCase.payload, providerSecret),
      recordPartnerConversion(makeTestDeps(), slug, testCase.payload, providerSecret),
    ]);
    expect(attempts.filter(result => !result.duplicate)).toHaveLength(1);
    expect(attempts.filter(result => result.duplicate)).toHaveLength(2);
    expect(attempts.every(result => result.rewardStatus === 'pending_verification' ||
      result.rewardStatus === 'already_recorded')).toBe(true);
    await checkEvidence(testCase);
  }, 120_000);

  it('rejects concurrent different event IDs for one buyer, even when both HMAC inputs are valid', async () => {
    const testCase = await fixture();
    const competing = { ...testCase.payload, eventId: testCase.payload.eventId + '-competing' };
    const results = await Promise.allSettled([
      recordPartnerConversion(makeTestDeps(), slug, testCase.payload, providerSecret),
      recordPartnerConversion(makeTestDeps(), slug, competing, providerSecret),
    ]);
    const successes = results.filter(result => result.status === 'fulfilled');
    const refusals = results.filter(result => result.status === 'rejected');
    expect(successes).toHaveLength(1);
    expect(refusals).toHaveLength(1);
    expect(refusals[0]).toMatchObject({
      status: 'rejected', reason: { code: 'duplicate_conversion', status: 409 },
    });
    const db = testCase.db;
    const [events, claims, ledgers, campaign] = await Promise.all([
      db.collection('partner_referral_conversions').where('campaignId', '==', testCase.campaignId).get(),
      db.collection('partner_referral_buyer_claims').where('campaignId', '==', testCase.campaignId).get(),
      db.collection('partner_referral_ledger').where('campaignId', '==', testCase.campaignId).get(),
      db.collection('partner_campaigns').doc(testCase.campaignId).get(),
    ]);
    expect(events.size).toBe(1);
    expect(claims.size).toBe(1);
    expect(ledgers.size).toBe(1);
    expect(events.docs[0]?.data()).toMatchObject({
      proofStatus: 'partner_assertion_only', rewardStatus: 'pending_verification',
    });
    expect(campaign.data()?.qualifiedConversions).toBe(0);
  }, 120_000);

  it('refuses retry after buyer revokes consent, without adding a new audit event', async () => {
    const testCase = await fixture();
    await recordPartnerConversion(makeTestDeps(), slug, testCase.payload, providerSecret);
    await testCase.db.collection('users').doc(testCase.buyer)
      .update({ partnerReferralConsent: false, partnerReferralVersion: 2 });
    await expect(recordPartnerConversion(makeTestDeps(), slug, testCase.payload, providerSecret))
      .rejects.toMatchObject({ code: 'conversion_not_eligible', status: 403 });
    await checkEvidence(testCase);
  }, 120_000);
});
