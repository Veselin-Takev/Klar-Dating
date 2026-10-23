import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, symlinkSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { readPrivacySources, screenPartnerPrivacySources, TARGET_SHA } from './screen-pr119-partner-privacy-boundary.mjs';

// Require a separately authenticated immutable PR119 checkout; do not test the audit branch as if it were the app target.
const dir = process.env.KLAR_PARTNER_PRIVACY_SOURCE_DIR;
if (!dir) throw new Error('KLAR_PARTNER_PRIVACY_SOURCE_DIR is required and must be verified against PR119 Git blobs');
const script = fileURLToPath(new URL('./screen-pr119-partner-privacy-boundary.mjs', import.meta.url));
const original = readPrivacySources(dir);
function mutation(name, key, before, after, expected, firstInPublicRedirect = false) {
  test(name, () => {
    const occurrences = original[key].split(before).length - 1;
    if (firstInPublicRedirect) {
      const begin = original[key].indexOf('const protectPublicPartnerRedirect =');
      const end = original[key].indexOf('const validatePublicPartnerToken =', begin);
      assert.ok(begin >= 0 && end > begin && original[key].slice(begin,end).includes(before), 'target must occur in public redirect');
    } else {
      assert.equal(occurrences, 1, 'fixture must be exact and unique: ' + name);
    }
    const variant = { ...original, [key]: original[key].replace(before, after) };
    const result = screenPartnerPrivacySources(variant);
    assert.equal(result.source_control_screen, 'MISSING_EXPECTED_SOURCE_CONTROLS');
    assert.ok(result.missing_controls.includes(expected), name + ': ' + JSON.stringify(result.missing_controls));
    assert.equal(result.production_release_decision, 'NO-GO');
  });
}

test('baseline: all 10 static boundaries observed, still NO-GO and never a provenance proof', () => {
  const result = screenPartnerPrivacySources(original);
  assert.equal(result.immutable_target, TARGET_SHA);
  assert.equal(result.checked_controls, 10);
  assert.equal(result.observed_controls, 10);
  assert.deepEqual(result.missing_controls, []);
  assert.equal(result.source_control_screen, 'STRUCTURE_OBSERVED_ONLY');
  assert.equal(result.source_integrity_proven_by_this_tool, false);
  assert.equal(result.production_release_decision, 'NO-GO');
  assert.ok(result.data_transfers_observed.includes('STABLE_EXTERNAL_KLAR_REFERRAL_QUERY_TOKEN'));
  assert.ok(result.unresolved_approval_evidence.includes('INDEPENDENT_DPO_LEGAL_APPROVAL'));
});

mutation('withdrawing consent no longer rotates epoch', 'service',
  'if (!allowed && currentlyAllowed) version += 1;', 'if (false) version += 1;', 'CONSENT_WITHDRAW_VERSION_INVALIDATES_TOKEN');
mutation('consent write omits epoch', 'service',
  'partnerReferralVersion: version,\n      partnerReferralConsentUpdatedAt: now,',
  'partnerReferralConsentUpdatedAt: now,', 'CONSENT_WITHDRAW_VERSION_INVALIDATES_TOKEN');
mutation('consent emergency quarantine fails to deny', 'service',
  'partnerReferralConsent: false,\n        partnerReferralEpochQuarantined: true,',
  'partnerReferralConsent: true,\n        partnerReferralEpochQuarantined: true,', 'CONSENT_WITHDRAW_VERSION_INVALIDATES_TOKEN');
mutation('stable external query token removed without reviewed replacement', 'service',
  "url.searchParams.set('klar_referral', token);", "url.searchParams.delete('klar_referral');", 'OUTBOUND_STABLE_PSEUDONYMOUS_QUERY_TOKEN');
mutation('direct owner open is no longer audit-bound', 'service',
  "await recordPartnerInteraction(deps, uid, campaignId, 'open_link');", "// no audit", 'DIRECT_OWNER_OPEN_GATED_AND_AUDITED');
mutation('click path ignores source owner consent', 'service',
  '!activeConsent || !visitorUid', 'false || !visitorUid', 'CLICK_OWNER_AND_VISITOR_CONSENT_GATES');
mutation('click path ignores initial visitor consent', 'service',
  'visitorSnap.data()?.partnerReferralConsent !== true', 'false', 'CLICK_OWNER_AND_VISITOR_CONSENT_GATES');
mutation('click transaction ignores visitor consent', 'service',
  'savedVisitor.data()?.partnerReferralConsent !== true', 'false', 'CLICK_OWNER_AND_VISITOR_CONSENT_GATES');
mutation('click transaction ignores account deletion state', 'service',
  'if (visitorDeletion.exists || !savedVisitor.exists', 'if (false || !savedVisitor.exists', 'CLICK_OWNER_AND_VISITOR_CONSENT_GATES');
mutation('click loses visitor epoch comparison', 'service',
  'savedVisitor.data()?.partnerReferralVersion !== visitorConsentVersion', 'false', 'CLICK_OWNER_AND_VISITOR_CONSENT_GATES');
mutation('click always forwards referral token despite false attribution result', 'service',
  'return tracked ? { url: trackedDestination(destination, token), tracked: true } : { url: destination, tracked: false };',
  'return { url: trackedDestination(destination, token), tracked: true };', 'CLICK_OWNER_AND_VISITOR_CONSENT_GATES');
mutation('public redirect loses no-referrer header', 'routes',
  "res.setHeader('Referrer-Policy', 'no-referrer');", "res.setHeader('X-Diagnostic', '1');", 'PUBLIC_REDIRECT_NO_REFERRER_AND_NO_STORE', true);
mutation('public redirect loses no-store header', 'routes',
  "res.setHeader('Cache-Control', 'private, no-store');", "res.setHeader('Cache-Control', 'public');", 'PUBLIC_REDIRECT_NO_REFERRER_AND_NO_STORE', true);
mutation('new conversion directly claims reward earned', 'service',
  "rewardStatus: 'pending_verification',\n      proofStatus: 'partner_assertion_only',",
  "rewardStatus: 'earned',\n      proofStatus: 'partner_assertion_only',", 'PROVIDER_ASSERTION_NO_IMMEDIATE_CREDIT');
mutation('conversion adds qualified counter increment', 'service',
  'tx.create(eventRef, {', 'tx.update(campaignRef, { qualifiedConversions: FieldValue.increment(1) });\n    tx.create(eventRef, {',
  'PROVIDER_ASSERTION_NO_IMMEDIATE_CREDIT');
mutation('owner deletion no longer quarantines referral', 'deletion',
  'await quarantineOwnedPartnerReferral(db, referral.ref, meineUid)', 'undefined', 'ERASURE_QUARANTINE_BEFORE_OWNER_REFERRAL_PURGE');
mutation('owner erasure deletes parent before buyer claims', 'deletion',
  "await loescheAbfrage(db.collection('partner_referral_buyer_claims')\n          .where('referralId', '==', referral.id));",
  "await referral.ref.delete(); // moved ahead of claim cleanup", 'ERASURE_QUARANTINE_BEFORE_OWNER_REFERRAL_PURGE');
mutation('owner erasure no longer visits conversion refs', 'deletion',
  "db.collection('partner_referral_conversions')", "db.collection('unrelated_events')", 'ERASURE_CONVERSION_CLAIM_LEDGER_AND_ADMIN_REFERENCES');
mutation('erasure no longer removes buyer claims by buyerRef', 'deletion',
  "db.collection('partner_referral_buyer_claims').where('buyerRef'", "db.collection('partner_referral_buyer_claims').where('unknownRef'",
  'ERASURE_CONVERSION_CLAIM_LEDGER_AND_ADMIN_REFERENCES');
mutation('erasure ignores audit ledger', 'deletion',
  "db.collection('partner_referral_ledger')", "db.collection('unrelated_ledger')",
  'ERASURE_CONVERSION_CLAIM_LEDGER_AND_ADMIN_REFERENCES');
mutation('quarantine no longer verifies owner UID', 'quarantine',
  'if (snapshot.data()?.ownerUid !== ownerUid)', 'if (false)', 'QUARANTINE_TRANSACTIONAL_OWNER_CHECK');
mutation('quarantine no longer blocks further assertions', 'quarantine',
  "tx.update(referralRef, { status: 'deleting' });", "tx.update(referralRef, { status: 'active' });",
  'QUARANTINE_TRANSACTIONAL_OWNER_CHECK');
mutation('retention open review erased', 'retention',
  '**Retention offen vor Produktivbetrieb:**', '**Retention bereits freigegeben:**', 'RETENTION_POLICY_STILL_UNAPPROVED');
mutation('finance evidence legal hold caveat removed', 'retention',
  'Keine TTL für notwendige Vertrags-/Finanznachweise', 'TTL für alle Vertrags-/Finanznachweise', 'RETENTION_POLICY_STILL_UNAPPROVED');

test('fail closed when source section is duplicated', () => {
  const result = screenPartnerPrivacySources({...original, service: original.service + original.service});
  assert.ok(result.missing_controls.includes('CONSENT_WITHDRAW_VERSION_INVALIDATES_TOKEN'));
  assert.equal(result.production_release_decision, 'NO-GO');
});
test('CLI emits NO-GO and nonzero exit even with observed controls', () => {
  const r = spawnSync(process.execPath, [script, '--source-dir', dir], { encoding:'utf8', timeout:10000 });
  assert.equal(r.status, 1, r.stderr);
  const data = JSON.parse(r.stdout);
  assert.equal(data.production_release_decision, 'NO-GO');
  assert.equal(data.source_control_screen, 'STRUCTURE_OBSERVED_ONLY');
});
test('CLI refuses missing source directory without side effects', () => {
  const r=spawnSync(process.execPath, [script, '--source-dir', '/definitely/not/a/checkout'], { encoding:'utf8', timeout:10000 });
  assert.equal(r.status,2);
  assert.match(r.stderr,/Privacy source screen failed closed/);
});
test('source reader rejects symlinked files', () => {
  const temp=mkdtempSync(join(tmpdir(),'klar-privacy-'));
  try {
    for (const name of ['src/server','src/server/routes','docs']) mkdirSync(join(temp,name),{recursive:true});
    symlinkSync(join(dir,'src/server/partnerReferralService.ts'),join(temp,'src/server/partnerReferralService.ts'));
    assert.throws(()=>readPrivacySources(temp),/unsupported_or_unsafe_source_file/);
  } finally { rmSync(temp,{recursive:true,force:true}); }
});
test('read-only scanner does not import application or access production SDK', () => {
  // API consists solely of fs and path checks; all output is a static assessment.
  assert.equal(typeof screenPartnerPrivacySources,'function');
  const res=screenPartnerPrivacySources(original);
  assert.equal(res.scanners_executed,0);
  assert.equal(res.cloud_calls,0);
});
