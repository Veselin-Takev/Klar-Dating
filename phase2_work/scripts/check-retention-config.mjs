#!/usr/bin/env node
// Issue #70: validate current 20-group TTL plan and original expiry writers.
// Static only: no GCP access, TTL mutation or live ACTIVE proof.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = path => readFileSync(resolve(root, path), 'utf8');
const script = read('scripts/configure-retention.sh');
const docs = read('docs/DATA_RETENTION.md');
const match = script.match(/(?:^|\n)groups=\(\s*([\s\S]*?)\s*\)/);
assert(match, 'Missing explicit retention groups=(...) in staging plan');
const groups = match[1].trim().split(/\s+/);
assert.equal(groups.length, 20, 'Current Firestore TTL plan must contain exactly 20 groups');
assert.equal(new Set(groups).size, groups.length, 'Duplicate collection groups are prohibited');

const originalGroups = [
  'messages', 'archived_messages', 'ki_zwischenspeicher', 'age_attempts',
  'kyc_events', 'deletion_log', 'funnel_events', 'ai_budget', 'account_deletions',
];
for (const group of originalGroups) {
  assert(groups.includes(group), 'Original expiry group missing from plan: ' + group);
}
for (const group of groups) {
  assert(new RegExp('--collection-group=' + group + '(?![A-Za-z0-9_-])').test(docs),
    'Documented Firestore TTL group missing or suffix-colliding: ' + group);
}
assert(docs.includes('alle **20 geplanten Collection Groups**'),
  'Current TTL evidence instructions must describe the 20-group plan, not historical 13');

const messages = read('src/server/messages.ts');
assert(messages.includes('expiresAt: new Date(Date.now() + 90 * 86400_000)'),
  'Message writer must preserve its 90-day expiresAt Date');
const archive = read('functions/src/archiveInactiveChats.ts');
assert(archive.includes("collection('archived_messages')") && archive.includes('...message.data()'),
  'Archival writer must preserve original message expiry');
const kyc = read('src/server/verification/diditKyc.ts');
assert(kyc.includes('kyc_events/') && kyc.includes('event.event_id')
  && kyc.includes('expiresAt: new Date(now + 30 * 86400_000)'),
  'KYC event writer must preserve its 30-day expiresAt Date');

// Storage photo cleanup is not Firestore TTL; independent gates cover it.
console.log('PASS: 20-group TTL plan/docs and original expiry writers (static-only; production NO-GO)');
