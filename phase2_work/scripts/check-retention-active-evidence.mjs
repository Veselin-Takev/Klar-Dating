#!/usr/bin/env node
// P0 #70 — validate saved read-only gcloud TTL evidence, not cloud state.
// Usage: node scripts/check-retention-active-evidence.mjs --evidence /path/to/ttls.json
//        --project approved-staging-id --database '(default)'
import { readFileSync } from 'node:fs';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const args = process.argv.slice(2);
const option = key => {
  const index = args.indexOf(key);
  assert(index >= 0 && index + 1 < args.length && !args[index + 1].startsWith('--'), 'Missing ' + key);
  return args[index + 1];
};
const preflight = args.includes('--mode');
assert.equal(args.length, preflight ? 8 : 6, 'Expected --evidence FILE --project ID --database ID [--mode preflight]');
if (preflight) assert.equal(option('--mode'), 'preflight', 'Only explicit preflight mode is supported');
const evidencePath = option('--evidence');
const projectId = option('--project');
const databaseId = option('--database');
assert(/^[a-z][a-z0-9-]{4,62}$/.test(projectId), 'Invalid project ID');
assert(/^[A-Za-z0-9_()-]+$/.test(databaseId), 'Invalid database ID');
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const provisioning = readFileSync(join(root, 'scripts/configure-retention.sh'), 'utf8');
const match = provisioning.match(/(?:^|\n)groups=\(\s*([\s\S]*?)\s*\)/);
assert(match, 'Approved TTL matrix is missing');
const required = match[1].trim().split(/\s+/);
assert.equal(required.length, 20, 'Expected 20 documented TTL groups');
const evidence = JSON.parse(readFileSync(evidencePath, 'utf8'));
assert(Array.isArray(evidence), 'Expected JSON array from gcloud firestore fields ttls list --format=json');
const actual = new Map();
const prefix = 'projects/' + projectId + '/databases/' + databaseId + '/collectionGroups/';
for (const field of evidence) {
  assert(field && typeof field === 'object' && !Array.isArray(field), 'Malformed TTL field');
  const name = field.name;
  assert(typeof name === 'string' && name.startsWith(prefix), 'TTL evidence does not match project/database: ' + name);
  const suffix = name.slice(prefix.length);
  const hit = /^([^/]+)\/fields\/([^/]+)$/.exec(suffix);
  assert(hit, 'Malformed scoped Firestore field name');
  const [, group, key] = hit;
  // `gcloud firestore fields ttls list` enumerates all configured TTL policies.
  // A successful check must not conceal additional, unreviewed deletion rules.
  assert(required.includes(group), 'Unapproved TTL policy found outside documented retention matrix: ' + group);
  assert.equal(key, 'expiresAt', 'TTL field must be expiresAt for ' + group);
  assert(!actual.has(group), 'Duplicate TTL evidence for ' + group);
  assert.equal(field.ttlConfig?.state, 'ACTIVE', 'TTL not ACTIVE for ' + group);
  const offset = field.ttlConfig?.expirationOffset;
  assert(offset === undefined || offset === '0s', 'Unexpected expiration offset for ' + group);
  actual.set(group, true);
}
if (!preflight) {
  assert.deepEqual([...actual.keys()].sort(), [...required].sort(), 'Missing ACTIVE TTL collection groups');
}
console.log(preflight
  ? 'PASS: existing scoped TTL policies are a compatible ACTIVE subset of the approved 20-group matrix (offline preflight, not live attestation).'
  : 'PASS: 20 ACTIVE expiresAt TTL fields for explicitly scoped project/database in supplied read-only evidence (not a live cloud check).');
