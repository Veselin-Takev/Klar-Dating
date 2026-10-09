#!/usr/bin/env node
import { readFileSync } from 'node:fs';

const purge = readFileSync('src/server/trustAndSafety.ts', 'utf8');
const accounting = readFileSync('src/server/deletionAccounting.ts', 'utf8');
const worker = readFileSync('src/server/accountDeletion.ts', 'utf8');
const retention = readFileSync('docs/DATA_RETENTION.md', 'utf8');
const catalog = readFileSync('scripts/loeschkaskade.mjs', 'utf8');
const failures = [];

for (const token of [
  "db.collection('partner_referrals').where('ownerUid', '==', meineUid)",
  "db.collection('partner_referral_conversions').where(field, '==', partnerUidRef)",
  "db.collection('partner_referral_buyer_claims').where('buyerRef', '==', partnerUidRef)",
  "db.collection('partner_referral_ledger').where(field, '==', partnerUidRef)",
  "pseudonymousPartnerUid(meineUid, consentAuditSecret())",
]) if (!purge.includes(token)) failures.push(`missing deletion receipt control: ${token}`);

for (const token of [
  'schemaVersion: 2', "status: 'completed'", 'expiresAt: new Date(completedAt.getTime() + 30 * 86_400_000)',
  'deletedChats: bericht.chats', 'deletedMessages: bericht.nachrichten',
  'pseudonymizedReports: bericht.pseudonymisiert',
  'const snapshot = await tx.get(query.limit(400));',
  'snapshot.docs.forEach(doc => tx.delete(doc.ref));',
  'writeCount(tx, counts, key, snapshot.size);',
  'deletion_accounting_migration_required',
]) if (!accounting.includes(token)) failures.push(`missing cumulative receipt control: ${token}`);
for (const token of [
  "current.phase === 'final_sweep'", 'const counts = readDeletionCounts(current);',
  'tx.create(receiptRef, buildDeletionAuditReceipt(counts, new Date(deps.now())));',
  'tx.set(activeJobRef', "status: 'completed'", "lastError: 'accounting_migration_required'",
]) if (!worker.includes(token)) failures.push(`missing final-sweep receipt control: ${token}`);
if (purge.includes("collection('deletion_log')")) failures.push('purge must not publish a premature completion receipt');
const start = accounting.indexOf('export function buildDeletionAuditReceipt');
const end = accounting.indexOf('/** Counted mutations', start);
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
