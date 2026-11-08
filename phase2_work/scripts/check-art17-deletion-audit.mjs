#!/usr/bin/env node
import { readFileSync } from 'node:fs';

// Git checkouts may use CRLF; assertions below compare canonical source text.
const readSource = path => readFileSync(path, 'utf8').replace(/\r\n/g, '\n');

const purge = readSource('src/server/trustAndSafety.ts');
const accounting = readSource('src/server/deletionAccounting.ts');
const worker = readSource('src/server/accountDeletion.ts');
const retention = readSource('docs/DATA_RETENTION.md');
const catalog = readSource('scripts/loeschkaskade.mjs');
const failures = [];

for (const token of [
  "db.list('partner_referrals', record, {where:['ownerUid','==',meineUid], limit:BATCH})",
  "select('partner_referral_conversions', field, partnerUidRef)",
  "select('partner_referral_buyer_claims', 'buyerRef', partnerUidRef)",
  "select('partner_referral_ledger', field, partnerUidRef)",
  "pseudonymousPartnerUid(meineUid, consentAuditSecret())",
]) if (!purge.includes(token)) failures.push(`missing deletion receipt control: ${token}`);

// Owner-linked buyer claims have no ownerRef; deleting only ownerRef-indexed
// conversions would leave orphaned buyer claims after account erasure.
const ownerCascadeStart = purge.indexOf('const ownedReferrals =');
const ownerCascadeEnd = purge.indexOf("for (const field of ['ownerRef', 'buyerRef'])", ownerCascadeStart + 1);
const cascadeStartToken = 'const ownedReferrals =';
const cascadeEndToken = "for (const field of ['ownerRef', 'buyerRef'])";
if (purge.split(cascadeStartToken).length !== 2 || purge.split(cascadeEndToken).length !== 2) {
  failures.push('owner referral cascade boundary markers must be unique');
}
if (ownerCascadeStart < 0 || ownerCascadeEnd <= ownerCascadeStart) {
  failures.push('owner referral cascade boundaries missing or invalid');
}
const ownerCascade = ownerCascadeStart >= 0 && ownerCascadeEnd > ownerCascadeStart
  ? purge.slice(ownerCascadeStart, ownerCascadeEnd)
  : '';
const lookup = ownerCascade.indexOf("'referralId', referral.id");
const perReferralSlice = ownerCascade.indexOf('for (const referral of ownedReferrals) {\n        checkDeletionSlice();');
if (perReferralSlice < 0) {
  failures.push('owner referral iteration must check deletion slice before each child purge');
}
const claimDeletion = ownerCascade.indexOf("await loescheAbfrage(select('partner_referral_buyer_claims'");
const quarantine = ownerCascade.indexOf('await quarantineOwnedPartnerReferral(db, `partner_referrals/${referral.id}`, meineUid)');
if (quarantine < 0 || !(quarantine < claimDeletion)) {
  failures.push('owner referral must be transactionally quarantined before buyer claims are purged');
}
const quarantineSource = readSource('src/server/partnerReferralDeletion.ts');
for (const required of [
  'return db.transaction<OwnerReferralQuarantineResult>(async tx =>',
  'const current = await tx.read(path, schema);',
  "if (current.ownerUid !== ownerUid)",
  "tx.write(path, schema.partial(), {status:'deleting'}, {merge:true});",
]) {
  if (!quarantineSource.includes(required)) failures.push('missing transactional quarantine guard: ' + required);
}
const parentDeletion = ownerCascade.indexOf("await accounting.deleteDocument(`partner_referrals/${referral.id}`)");
const beforeParentGuard = ownerCascade.indexOf('checkDeletionSlice();\n        // Do not remove the parent pointer');
if (beforeParentGuard < 0 || !(claimDeletion < beforeParentGuard && beforeParentGuard < parentDeletion)) {
  failures.push('owner referral parent deletion must recheck slice after buyer-claim purge');
}

if (lookup < 0 || claimDeletion < 0 || parentDeletion < 0 || !(claimDeletion < parentDeletion) || !(lookup < parentDeletion)) {
  failures.push('owner deletion must remove buyer claims by referralId before deleting referral parent');
}

for (const token of [
  'schemaVersion: 2', "status: 'completed'", 'expiresAt: new Date(completedAt.getTime() + 30 * 86_400_000)',
  'deletedChats: bericht.chats', 'deletedMessages: bericht.nachrichten',
  'pseudonymizedReports: bericht.pseudonymisiert',
  'const rows = await tx.list(query.path, record, {limit:200,',
  'for (const row of rows) tx.delete(`${query.path}/${row.id}`);',
  'writeCount(tx, counts, key, rows.length);',
  'deletion_accounting_migration_required',
]) if (!accounting.includes(token)) failures.push(`missing cumulative receipt control: ${token}`);
for (const token of [
  "current.phase === 'final_sweep'", 'const counts = readDeletionCounts(current);',
  'tx.create(receiptRef, deletionRecord, buildDeletionAuditReceipt(counts, new Date(deps.now())));',
  'tx.write(activeJobRef', "status: 'completed'", "lastError: 'accounting_migration_required'",
]) if (!worker.includes(token)) failures.push(`missing final-sweep receipt control: ${token}`);
if (purge.includes("collection('deletion_log')")) failures.push('purge must not publish a premature completion receipt');
const start = accounting.indexOf('export function buildDeletionAuditReceipt');
const end = accounting.indexOf('export interface TenantSelection', start);
const receipt = accounting.slice(start, end);
for (const forbidden of ['uid', 'requestId', 'email', 'sessionId', 'provider']) {
  if (receipt.includes(forbidden)) failures.push(`deletion receipt must not contain ${forbidden}`);
}

if (!retention.includes('/deletion_log') || !retention.includes('Frist:** 30 Tage')) failures.push('deletion_log retention policy missing');
if (!catalog.includes("deletion_log: { legacy: true, art: 'bleibt'")) failures.push('deletion_log must remain in the cascade catalog');

if (failures.length) {
  console.error('Art. 17 deletion audit boundary: FAIL');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
console.log('Art. 17 deletion audit boundary: PASS');
