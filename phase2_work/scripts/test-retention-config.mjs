#!/usr/bin/env node
// Issue #70: seven offline fail-closed source and documentation mutations.
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const paths = [
  'scripts/configure-retention.sh',
  'docs/DATA_RETENTION.md',
  'src/server/messages.ts',
  'functions/src/archiveInactiveChats.ts',
  'src/server/verification/diditKyc.ts',
];
const original = new Map(paths.map(p => [p, readFileSync(resolve(root, p), 'utf8')]));
const checker = readFileSync(resolve(root, 'scripts/check-retention-config.mjs'), 'utf8');
const cases = [
  ['remove archived messages group', 'scripts/configure-retention.sh',
    'messages archived_messages', 'messages'],
  ['remove a newly tracked group', 'scripts/configure-retention.sh',
    'kyc_start_rate_limits kyc_reconciliation_events', 'kyc_start_rate_limits'],
  ['documentation suffix collision', 'docs/DATA_RETENTION.md',
    '--collection-group=messages', '--collection-group=messages_backup'],
  ['stale 13-group evidence language', 'docs/DATA_RETENTION.md',
    'alle **20 geplanten Collection Groups**', 'alle 13 Collection Groups'],
  ['remove message expiry', 'src/server/messages.ts',
    'expiresAt: new Date(Date.now() + 90 * 86400_000)', 'expiresAt: null'],
  ['lose archived expiry', 'functions/src/archiveInactiveChats.ts',
    '...message.data()', 'archivedAt: null'],
  ['remove KYC expiry', 'src/server/verification/diditKyc.ts',
    'expiresAt: new Date(now + 30 * 86400_000)', 'expiresAt: null'],
];
function run(override) {
  const temp = mkdtempSync(join(tmpdir(), 'klar-ttl-config-'));
  try {
    for (const [path, value] of original) {
      const filename = join(temp, path);
      mkdirSync(dirname(filename), { recursive: true });
      writeFileSync(filename, override?.path === path ? override.value : value);
    }
    const gate = join(temp, 'scripts/check-retention-config.mjs');
    writeFileSync(gate, checker);
    return spawnSync(process.execPath, [gate], { encoding: 'utf8', timeout: 10000 });
  } finally {
    rmSync(temp, { recursive: true, force: true });
  }
}
const good = run();
assert.equal(good.status, 0, 'Canonical TTL guard unexpectedly failed: ' + good.stderr);
for (const [label, path, before, after] of cases) {
  const source = original.get(path);
  assert(source?.includes(before), 'Mutation input missing: ' + label);
  const mutated = source.replace(before, after);
  assert.notEqual(mutated, source, 'Mutation ineffective: ' + label);
  const bad = run({ path, value: mutated });
  assert.notEqual(bad.status, 0, 'Fail-open TTL config regression: ' + label);
}
console.log('PASS: TTL config and ' + cases.length + ' fail-closed mutations (offline)');
