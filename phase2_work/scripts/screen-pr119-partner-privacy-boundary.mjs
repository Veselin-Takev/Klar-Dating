#!/usr/bin/env node
// PR #119 P0 #56 source-only boundary screen. NO-GO even for an observed structure.
// Does not claim actual consent validity, independent source provenance, legal
// approvals, provider log control, Art.17 E2E or authenticated cloud state.
import { readFileSync, lstatSync } from 'node:fs';
import { resolve, relative, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';

export const TARGET_SHA = '7fdf29010c85f16a9b38e5c93186f32e92192f3a';
const FILES = Object.freeze({
  service: 'src/server/partnerReferralService.ts',
  routes: 'src/server/routes/partnerReferrals.ts',
  deletion: 'src/server/trustAndSafety.ts',
  quarantine: 'src/server/partnerReferralDeletion.ts',
  retention: 'docs/DATA_RETENTION.md',
});

function boundedSource(dir, name) {
  const base = resolve(dir);
  const path = resolve(base, name);
  const rel = relative(base, path);
  if (rel.startsWith('..') || isAbsolute(rel)) throw new Error('unsafe_source_path');
  const stats = lstatSync(path);
  if (!stats.isFile() || stats.isSymbolicLink() || stats.nlink !== 1 || stats.size > 1_000_000) {
    throw new Error('unsupported_or_unsafe_source_file:' + name);
  }
  const text = readFileSync(path, 'utf8');
  if (Buffer.byteLength(text, 'utf8') !== stats.size) throw new Error('source_file_changed:' + name);
  return text;
}

function uniqueSection(source, start, end) {
  const occurrences = source.split(start).length - 1;
  if (occurrences !== 1) return '';
  const from = source.indexOf(start);
  const until = end ? source.indexOf(end, from + start.length) : source.length;
  if (from < 0 || until <= from) return '';
  return source.slice(from, until);
}

function checksFrom(s) {
  const consent = uniqueSection(s.service, 'export async function setPartnerConsent(', 'function buildPartnerUrl(');
  const opening = uniqueSection(s.service, 'export async function openPartnerReferral(', 'export async function recordPartnerClick(');
  const click = uniqueSection(s.service, 'export async function recordPartnerClick(', 'export async function recordPartnerConversion(');
  const conversion = uniqueSection(s.service, 'export async function recordPartnerConversion(', '');
  const cascade = uniqueSection(s.deletion, '// Klar & Partner Art. 17:', '// Consent audit entries are append-only');
  const route = uniqueSection(s.routes, 'const protectPublicPartnerRedirect =', 'const validatePublicPartnerToken =');
  const quarantine = uniqueSection(s.quarantine, 'export async function quarantineOwnedPartnerReferral(', '');
  return [
    {
      id: 'CONSENT_WITHDRAW_VERSION_INVALIDATES_TOKEN',
      observed: consent.includes("if (!allowed && currentlyAllowed) version += 1;")
        && consent.includes('partnerReferralConsent: allowed')
        && consent.includes('partnerReferralVersion: version')
        && consent.includes('partnerReferralConsent: false')
        && consent.includes('partnerReferralEpochQuarantined: true'),
    },
    {
      id: 'OUTBOUND_STABLE_PSEUDONYMOUS_QUERY_TOKEN',
      observed: s.service.includes("url.searchParams.set('klar_referral', token);")
        && s.service.includes('function trackedDestination(destinationUrl: string, token: string)'),
    },
    {
      id: 'DIRECT_OWNER_OPEN_GATED_AND_AUDITED',
      observed: opening.includes("await recordPartnerInteraction(deps, uid, campaignId, 'open_link');")
        && opening.includes('return { url: trackedDestination(campaign.destinationUrl, token) };'),
    },
    {
      id: 'CLICK_OWNER_AND_VISITOR_CONSENT_GATES',
      observed: click.includes('!activeConsent || !visitorUid')
        && click.includes('visitorSnap.data()?.partnerReferralConsent !== true')
        && click.includes('savedVisitor.data()?.partnerReferralConsent !== true')
        && click.includes('visitorDeletion.exists')
        && click.includes('savedVisitor.data()?.partnerReferralVersion !== visitorConsentVersion')
        && click.includes('return tracked ? { url: trackedDestination(destination, token), tracked: true } : { url: destination, tracked: false };'),
    },
    {
      id: 'PUBLIC_REDIRECT_NO_REFERRER_AND_NO_STORE',
      observed: route.includes("res.setHeader('Cache-Control', 'private, no-store')")
        && route.includes("res.setHeader('Referrer-Policy', 'no-referrer')"),
    },
    {
      id: 'PROVIDER_ASSERTION_NO_IMMEDIATE_CREDIT',
      observed: conversion.includes("rewardStatus: 'pending_verification'")
        && conversion.includes("proofStatus: 'partner_assertion_only'")
        && !/qualifiedConversions\s*:\s*FieldValue\.increment/.test(conversion)
        && !/rewardStatus\s*:\s*['"]earned['"]/.test(conversion),
    },
    {
      id: 'ERASURE_QUARANTINE_BEFORE_OWNER_REFERRAL_PURGE',
      observed: cascade.includes(".where('ownerUid', '==', meineUid).limit(BATCH).get()")
        && cascade.includes('await quarantineOwnedPartnerReferral(db, referral.ref, meineUid)')
        && cascade.includes("await loescheAbfrage(db.collection('partner_referral_buyer_claims')")
        && cascade.includes('await referral.ref.delete()')
        && cascade.indexOf('await quarantineOwnedPartnerReferral') < cascade.indexOf("await loescheAbfrage(db.collection('partner_referral_buyer_claims')")
        && cascade.indexOf("await loescheAbfrage(db.collection('partner_referral_buyer_claims')") < cascade.indexOf('await referral.ref.delete()'),
    },
    {
      id: 'ERASURE_CONVERSION_CLAIM_LEDGER_AND_ADMIN_REFERENCES',
      observed: cascade.includes("['ownerRef', 'buyerRef']")
        && cascade.includes("db.collection('partner_referral_conversions')")
        && cascade.includes("db.collection('partner_referral_buyer_claims').where('buyerRef'")
        && cascade.includes("['actorRef', 'ownerRef', 'buyerRef']")
        && cascade.includes("db.collection('partner_referral_ledger')")
        && cascade.includes("['createdByRef', 'updatedByRef', 'verifiedByRef']"),
    },
    {
      id: 'QUARANTINE_TRANSACTIONAL_OWNER_CHECK',
      observed: quarantine.includes('return db.runTransaction<OwnerReferralQuarantineResult>')
        && quarantine.includes('if (snapshot.data()?.ownerUid !== ownerUid)')
        && quarantine.includes("tx.update(referralRef, { status: 'deleting' });"),
    },
    {
      id: 'RETENTION_POLICY_STILL_UNAPPROVED',
      observed: s.retention.includes('**Retention offen vor Produktivbetrieb:**')
        && s.retention.includes('Keine TTL für notwendige Vertrags-/Finanznachweise'),
    },
  ];
}

export function screenPartnerPrivacySources(source) {
  const checks = checksFrom(source);
  const missing = checks.filter(x => !x.observed).map(x => x.id);
  return {
    schema_version: 1,
    immutable_target: TARGET_SHA,
    source_integrity_proven_by_this_tool: false,
    source_control_screen: missing.length ? 'MISSING_EXPECTED_SOURCE_CONTROLS' : 'STRUCTURE_OBSERVED_ONLY',
    checked_controls: checks.length,
    observed_controls: checks.length - missing.length,
    missing_controls: missing,
    data_transfers_observed: ['STABLE_EXTERNAL_KLAR_REFERRAL_QUERY_TOKEN'],
    unresolved_approval_evidence: [
      'ARTICLE_6_LAWFUL_BASIS_PER_PURPOSE',
      'ARTICLE_9_SCREENING_IF_SPECIAL_CATEGORY_DATA_APPLICABLE',
      'VVT_CONTROLLER_PROCESSOR_AND_RECIPIENTS',
      'DPIA_SCREENING_DECISION',
      'PARTNER_LOGS_TRANSFER_AND_TOKEN_RETENTION',
      'LEGAL_HOLD_AND_ARTICLE_17_EXCEPTIONS',
      'LIVE_ERASURE_WITH_EMULATOR_AND_STAGING',
      'INDEPENDENT_DPO_LEGAL_APPROVAL',
    ],
    scanners_executed: 0,
    cloud_calls: 0,
    production_release_decision: 'NO-GO',
    issues_open: [55, 56, 57, 70, 8],
  };
}

export function readPrivacySources(sourceDir) {
  return Object.fromEntries(Object.entries(FILES).map(([key, path]) => [key, boundedSource(sourceDir, path)]));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    if (process.argv.length !== 4 || process.argv[2] !== '--source-dir') throw new Error('usage: --source-dir ORIGINAL_PR119_PHASE2_WORK');
    const result = screenPartnerPrivacySources(readPrivacySources(process.argv[3]));
    process.stdout.write(JSON.stringify(result, null, 2) + '\n');
    // This is intentionally an unmet data protection decision gate.
    process.exitCode = 1;
  } catch (error) {
    process.stderr.write('Privacy source screen failed closed: ' + (error instanceof Error ? error.message : 'unknown') + '\n');
    process.exitCode = 2;
  }
}
