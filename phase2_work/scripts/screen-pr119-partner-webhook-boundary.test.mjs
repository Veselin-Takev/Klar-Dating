import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { screenPartnerWebhookSources, screenFromDirectory, SOURCE_FILES } from './screen-pr119-partner-webhook-boundary.mjs';

// The full original source fixture must be an independently Git-blob-verified
// checkout/snapshot; mutation fixtures DO NOT prove end-to-end runtime behavior.
const here = dirname(fileURLToPath(import.meta.url));
const sourceRoot = process.env.KLAR_WEBHOOK_SCREEN_SOURCE_DIR || resolve(here, '..');
const original = Object.fromEntries(Object.entries(SOURCE_FILES).map(([k, v]) =>
  [k, readFileSync(join(sourceRoot, v), 'utf8')]));

const baseline = screenPartnerWebhookSources(original);
test('exact inspected source maintains structural non-credit guard but remains NO-GO', () => {
  assert.equal(baseline.structural_checks_passed, true, baseline.screen_findings.join(', '));
  assert.deepEqual(baseline.screen_findings, []);
  assert.equal(baseline.production_release_decision, 'NO-GO');
  assert.equal(baseline.independently_authenticated_buyer_purchase, false);
  assert.equal(baseline.verified_settlement_and_refund_lifecycle, false);
  assert.equal(screenFromDirectory(sourceRoot).structural_checks_passed, true);
});
const mutations = [
  ['partner timestamp freshness check widened', 'core', 'Math.abs(nowSeconds - parsedTime) > 300', 'Math.abs(nowSeconds - parsedTime) > 3000'],
  ['constant-time equality removed', 'core', 'crypto.timingSafeEqual(expectedBytes, suppliedBytes)', 'expectedBytes.equals(suppliedBytes)'],
  ['HMAC domain separator dropped', 'core', "'klar-partner-webhook:v1\\n'", "'bad-domain:'"],
  ['non-strict provider assertion schema', 'core', '}).strict();\n\nexport type PartnerCampaignInput', '});\n\nexport type PartnerCampaignInput'],
  ['webhook authentication bypass', 'route', '!verifyPartnerWebhookSignature(parsed.data, timestamp, signature, secret)', 'false'],
  ['webhook 401 made success', 'route', "return res.status(401).json({ code: 'invalid_partner_signature'", "return res.status(200).json({ code: 'invalid_partner_signature'"],
  ['self-referral denial removed', 'service', 'ownerUid === payload.buyerUid', 'false'],
  ['tamper-resistant referral HMAC removed', 'service', 'derivePartnerReferralToken(ownerUid, campaignId, initialVersion, referralSecret(deps)) !== payload.referralToken', 'false'],
  ['transaction boundary removed', 'service', 'db.runTransaction(async tx => {', 'db.transactionUnsafe(async tx => {'],
  ['campaign slug validation removed', 'service', 'campaign?.slug !== slug', 'false'],
  ['owner consent validation removed', 'service', 'owner?.partnerReferralConsent !== true', 'false'],
  ['buyer consent validation removed', 'service', 'buyer?.partnerReferralConsent !== true', 'false'],
  ['deleted account validation removed', 'service', 'ownerDeletion.exists || buyerDeletion.exists', 'false'],
  ['duplicate event binding removed', 'service', 'eventSnap.data()?.eventBinding !== eventBinding', 'false'],
  ['buyer consent epoch mismatch permitted', 'service', 'buyerClaimSnap.data()?.buyerConsentVersion !== buyerConsentVersion', 'false'],
  ['duplicate timestamp consistency removed', 'service', 'buyerClaimSnap.data()?.createdAt !== eventSnap.data()?.createdAt', 'false'],
  ['buyer claim uniqueness disabled', 'service', "if (buyerClaimSnap.exists) throw new PartnerReferralError(409, 'duplicate_conversion'", "if (false) throw new PartnerReferralError(409, 'duplicate_conversion'"],
  ['claim creation removed', 'service', 'tx.create(buyerClaimRef, {', 'tx.set(buyerClaimRef, {'],
  ['conversion record uses immediate earned', 'service', "rewardStatus: 'pending_verification',\n      proofStatus: 'partner_assertion_only'", "rewardStatus: 'earned',\n      proofStatus: 'partner_assertion_only'"],
  ['conversion record falsely verified', 'service', "rewardStatus: 'pending_verification',\n      proofStatus: 'partner_assertion_only',", "rewardStatus: 'pending_verification',\n      proofStatus: 'verified_with_purchase',"],
  ['webhook response reports immediate earned', 'service', "result.duplicate ? 'already_recorded' : 'pending_verification'", "result.duplicate ? 'already_recorded' : 'earned'"],
  ['mock no-credit campaign assertion removed', 'tests', "db._store.get('partner_campaigns/' + campaignId)?.qualifiedConversions).toBe(0)", "db._store.get('partner_campaigns/' + campaignId)?.qualifiedConversions).toBe(1)"],
  ['mock no-credit referral assertion removed', 'tests', "db._store.get('partner_referrals/' + referralId)?.qualifiedConversions).toBe(0)", "db._store.get('partner_referrals/' + referralId)?.qualifiedConversions).toBe(1)"],
];
for (const [label, file, needle, replacement] of mutations) {
  test(`fail closed: ${label}`, () => {
    const input = original[file];
    // Limit substitutions to the audited function or exact conversion test;
    // earlier app functions and test cases may legitimately contain the same text.
    const start = file === 'service' ? input.indexOf('export async function recordPartnerConversion(')
      : file === 'tests' ? input.indexOf("it('quarantines signed but independently unverified partner claims") : 0;
    assert.ok(start >= 0, `${label}: audited section missing`);
    const prefix = input.slice(0, start);
    const section = input.slice(start);
    assert.ok(section.includes(needle), `${label}: mutation needle missing inside target`);
    const changed = { ...original, [file]: prefix + (file === 'tests'
      ? section.replaceAll(needle, replacement) : section.replace(needle, replacement)) };
    const r = screenPartnerWebhookSources(changed);
    assert.equal(r.structural_checks_passed, false, `Missed regression: ${label}`);
    assert.equal(r.production_release_decision, 'NO-GO');
  });
}
test('inserting direct qualified credit in conversion is prohibited', () => {
  const needle = '    tx.create(audit.ref, withLedgerDetails(deps, audit,';
  assert.ok(original.service.includes(needle));
  const mutated = original.service.replace(needle, '    tx.update(campaignRef, { qualifiedConversions: FieldValue.increment(1) });\n' + needle);
  const r = screenPartnerWebhookSources({ ...original, service: mutated });
  assert.equal(r.structural_checks_passed, false);
  assert.ok(r.screen_findings.includes('unverified_partner_assertion_must_not_credit_or_earn'));
});
test('missing/empty source fails closed', () => {
  assert.throws(() => screenPartnerWebhookSources({ ...original, service: '' }), TypeError);
});
test('CLI requires an explicit source root; it does not silently select a checkout', () => {
  const result = spawnSync(process.execPath, [join(here, 'screen-pr119-partner-webhook-boundary.mjs')], { encoding: 'utf8', timeout: 10000 });
  assert.equal(result.status, 2);
});
