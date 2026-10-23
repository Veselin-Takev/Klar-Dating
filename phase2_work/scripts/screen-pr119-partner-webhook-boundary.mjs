#!/usr/bin/env node
/**
 * Read-only structural screening of the PR119 partner conversion assertion path.
 * This is not a TypeScript parser, not a Firestore test, not proof of purchase
 * authenticity, not a qualified release gate, and NEVER makes a GO decision.
 */
import { readFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const TARGET_PR_SHA = '7fdf29010c85f16a9b38e5c93186f32e92192f3a';
export const SOURCE_FILES = Object.freeze({
  core: 'src/server/partnerReferralCore.ts',
  service: 'src/server/partnerReferralService.ts',
  route: 'src/server/routes/partnerReferrals.ts',
  tests: 'tests/partnerReferralService.spec.ts',
});

export function screenPartnerWebhookSources({ core, service, route, tests }) {
  for (const [name, source] of Object.entries({ core, service, route, tests })) {
    if (typeof source !== 'string' || source.length < 500) {
      throw new TypeError(`Missing or incomplete source: ${name}`);
    }
  }
  const failures = [];
  const requireMatch = (name, text, expression) => {
    if (!expression.test(text)) failures.push(name);
  };
  const convMarker = 'export async function recordPartnerConversion(';
  const convStart = service.indexOf(convMarker);
  if (convStart < 0 || convStart !== service.lastIndexOf(convMarker)) failures.push('unique_conversion_function_missing');
  const conversion = convStart < 0 ? '' : service.slice(convStart);
  const sigStart = core.indexOf('export function verifyPartnerWebhookSignature(');
  const signature = sigStart < 0 ? '' : core.slice(sigStart);
  const endpointStart = route.indexOf("router.post('/partner/webhook/:slug'");
  const endpointEnd = route.indexOf('\n  return router;', endpointStart + 1);
  const endpoint = endpointStart >= 0 && endpointEnd > endpointStart ? route.slice(endpointStart, endpointEnd) : '';
  if (!endpoint) failures.push('webhook_endpoint_missing');

  // A verified signature authenticates only a key-holder assertion.
  requireMatch('strict_provider_assertion_payload', core, /PartnerConversionPayloadSchema\s*=\s*z\.object\(\{[\s\S]*?event:\s*z\.literal\('qualified_conversion'\)[\s\S]*?eventId:[\s\S]*?referralToken:[\s\S]*?buyerUid:[\s\S]*?\}\)\.strict\(\)/);
  requireMatch('signature_window_300_seconds', signature, /Math\.abs\(nowSeconds\s*-\s*parsedTime\)\s*>\s*300(?!\d)/);
  requireMatch('signature_constant_time_comparison', signature, /crypto\.timingSafeEqual\(expectedBytes,\s*suppliedBytes\)/);
  requireMatch('signature_hmac_domain_separator', core, /klar-partner-webhook:v1\\n/);
  requireMatch('signature_canonical_payload', core, /canonicalizeAuditPayload\(payload\)/);
  requireMatch('webhook_rejects_invalid_signature', endpoint, /!secret\s*\|\|\s*!verifyPartnerWebhookSignature\(parsed\.data,\s*timestamp,\s*signature,\s*secret\)/);
  requireMatch('webhook_failure_is_401', endpoint, /return res\.status\(401\)\.json\(\{ code: 'invalid_partner_signature'/);
  if (endpoint.indexOf('verifyPartnerWebhookSignature(') >= endpoint.indexOf('recordPartnerConversion(')) {
    failures.push('signature_must_precede_service_call');
  }

  // Transactional eligibility and rollback-safe duplicate claims are existing guardrails.
  requireMatch('self_referral_denied', conversion, /ownerUid\s*===\s*payload\.buyerUid/);
  requireMatch('token_rebound_to_owner_campaign_epoch', conversion, /derivePartnerReferralToken\(ownerUid,\s*campaignId,\s*initialVersion,\s*referralSecret\(deps\)\)\s*!==\s*payload\.referralToken/);
  requireMatch('transactional_all_reads', conversion, /db\.runTransaction\(async tx =>[\s\S]*?await tx\.getAll\(/);
  requireMatch('campaign_matches_signed_slug', conversion, /campaign\?\.slug\s*!==\s*slug/);
  requireMatch('both_accounts_have_consent', conversion, /owner\?\.partnerReferralConsent\s*!==\s*true[\s\S]*?buyer\?\.partnerReferralConsent\s*!==\s*true/);
  requireMatch('deleting_accounts_denied', conversion, /ownerDeletion\.exists\s*\|\|\s*buyerDeletion\.exists/);
  requireMatch('buyer_consent_epoch_binding', conversion, /buyerClaimSnap\.data\(\)\?\.buyerConsentVersion\s*!==\s*buyerConsentVersion/);
  requireMatch('replay_event_binding', conversion, /eventSnap\.data\(\)\?\.eventBinding\s*!==\s*eventBinding/);
  requireMatch('replay_timestamp_consistency', conversion, /buyerClaimSnap\.data\(\)\?\.createdAt\s*!==\s*eventSnap\.data\(\)\?\.createdAt/);
  requireMatch('duplicate_buyer_claim_denied', conversion, /if\s*\(buyerClaimSnap\.exists\)\s*throw new PartnerReferralError\(409,\s*'duplicate_conversion'/);
  // Scope the assertion-status invariant ONLY to the event-creation object,
  // never permit a nearby audit-record string to satisfy this check.
  const eventStart = conversion.indexOf('tx.create(eventRef, {');
  const eventEnd = eventStart < 0 ? -1 : conversion.indexOf('\n    });', eventStart);
  const eventRecord = eventStart >= 0 && eventEnd > eventStart ? conversion.slice(eventStart, eventEnd + 7) : '';
  requireMatch('assertion_record_is_pending', eventRecord, /tx\.create\(eventRef,\s*\{[\s\S]*?rewardStatus:\s*'pending_verification',[\s\S]*?proofStatus:\s*'partner_assertion_only'/);
  requireMatch('buyer_claim_creation', conversion, /tx\.create\(buyerClaimRef,\s*\{/);
  requireMatch('pending_or_duplicate_response', conversion, /rewardStatus:\s*result\.duplicate\s*\?\s*'already_recorded'\s*:\s*'pending_verification'/);
  requireMatch('mock_test_requires_pending', tests, /rewardStatus:\s*'pending_verification',\s*proofStatus:\s*'partner_assertion_only'/);
  requireMatch('mock_test_requires_zero_campaign_credit', tests, /get\('partner_campaigns\/'.*?\)\?\.qualifiedConversions\)\.toBe\(0\)/);
  requireMatch('mock_test_requires_zero_referral_credit', tests, /get\('partner_referrals\/'.*?\)\?\.qualifiedConversions\)\.toBe\(0\)/);
  if (/\b(?:rewardStatus\s*:\s*['"]earned['"]|FieldValue\.increment\(\s*1\s*\)[^\n]*qualifiedConversions|qualifiedConversions\s*:\s*FieldValue\.increment\()/m.test(conversion)
      || /tx\.(?:update|set)\(\s*(?:campaignRef|referralRef)\s*,\s*\{[^}]*qualifiedConversions/s.test(conversion)) {
    failures.push('unverified_partner_assertion_must_not_credit_or_earn');
  }
  // Deliberately report absence of proof. This screen CANNOT establish verified purchase.
  return Object.freeze({
    target_commit: TARGET_PR_SHA,
    scope: 'static_source_screen_only',
    structural_checks_passed: failures.length === 0,
    screen_findings: failures,
    partner_claim_is_purchase_proof: false,
    independently_authenticated_buyer_purchase: false,
    verified_settlement_and_refund_lifecycle: false,
    production_release_decision: 'NO-GO',
    host_gates_qualified: 0,
    independent_approvals_authenticated: 0,
  });
}

export function screenFromDirectory(root) {
  const files = Object.fromEntries(Object.entries(SOURCE_FILES).map(([name, rel]) =>
    [name, readFileSync(join(root, rel), 'utf8')]));
  return screenPartnerWebhookSources(files);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const idx = process.argv.indexOf('--source-dir');
  if (idx < 0 || idx + 2 !== process.argv.length || idx !== 2) {
    process.stderr.write('Usage: node screen-pr119-partner-webhook-boundary.mjs --source-dir PATH\n');
    process.exitCode = 2;
  } else {
    try {
      const result = screenFromDirectory(resolve(process.argv[idx + 1]));
      process.stdout.write(JSON.stringify(result, null, 2) + '\n');
      process.exitCode = result.structural_checks_passed ? 0 : 1;
    } catch (error) {
      process.stderr.write('Partner webhook static source screen failed closed: ' + String(error.message ?? error) + '\n');
      process.exitCode = 1;
    }
  }
}
