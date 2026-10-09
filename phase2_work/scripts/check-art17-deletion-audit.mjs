#!/usr/bin/env node
import { readFileSync } from 'node:fs';

const purge = readFileSync('src/server/trustAndSafety.ts', 'utf8');
const retention = readFileSync('docs/DATA_RETENTION.md', 'utf8');
const catalog = readFileSync('scripts/loeschkaskade.mjs', 'utf8');
const failures = [];

for (const token of [
  "receiptRef.create({ ...receipt, completedAt: FieldValue.serverTimestamp() });",
  "schemaVersion: 1",
  "status: 'completed'",
  'expiresAt: new Date(completedAt.getTime() + 30 * 86_400_000)',
  'deletedChats: bericht.chats',
  'deletedMessages: bericht.nachrichten',
  'pseudonymizedReports: bericht.pseudonymisiert',
  "db.collection('partner_referrals').where('ownerUid', '==', meineUid)",
  "db.collection('partner_referral_conversions').where(field, '==', partnerUidRef)",
  "db.collection('partner_referral_buyer_claims').where('buyerRef', '==', partnerUidRef)",
  "db.collection('partner_referral_ledger').where(field, '==', partnerUidRef)",
  "pseudonymousPartnerUid(meineUid, consentAuditSecret())",
]) if (!purge.includes(token)) failures.push(`missing deletion receipt control: ${token}`);

for (const forbidden of ['meineUid', 'requestId', 'email', 'sessionId', 'provider']) {
  const start = purge.indexOf('receiptRef.create({ ...receipt, completedAt: FieldValue.serverTimestamp() });');
  const end = purge.indexOf('});', start);
  const receipt = purge.slice(start, end);
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
