#!/usr/bin/env node
// P0 #70: mutation regressions for the fail-closed TTL matrix guard.
// All executions use disposable files; no gcloud or Firestore operations.
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const source = readFileSync(join(root, 'scripts/configure-retention.sh'), 'utf8');
const docs = readFileSync(join(root, 'docs/DATA_RETENTION.md'), 'utf8');
const guard = readFileSync(join(root, 'scripts/check-retention-matrix.mjs'), 'utf8');
const legacyCron = readFileSync(join(root, 'functions/src/deleteExpiredPhotos.ts'), 'utf8');
const cases = [
  ['removed collection group', s => s.replace('archived_messages ', ''), d => d],
  ['duplicate collection group', s => s.replace('messages archived_messages', 'messages messages archived_messages'), d => d],
  ['missing legal approval condition', s => s.replace('[[ "${KLAR_RETENTION_LEGAL_APPROVED:-}" == true ]]', '[[ true == true ]]'), d => d],
  ['missing staging project identity', s => s.replaceAll('KLAR_APPROVED_STAGING_PROJECT_ID', 'KLAR_UNCHECKED_PROJECT'), d => d],
  ['missing database-scoped mutation', s => s.replace('--database="${KLAR_DATABASE_ID}"', '--database=unscoped'), d => d],
  ['missing documented TTL group', s => s, d => d.replace('--collection-group=partner_referral_user_rate_limits', '--collection-group=undocumented_group')],
  ['removed KYC reconciliation TTL group', s => s.replace('kyc_start_rate_limits kyc_reconciliation_events', 'kyc_start_rate_limits'), d => d],
  ['removed new 20-group approval', s => s.replaceAll('KLAR_RETENTION_MATRIX_REVISION_APPROVED', 'KLAR_UNAPPROVED_TTL_MATRIX'), d => d],
  ['removed TTL preflight list query', s => s.replace('gcloud firestore fields ttls list --project=', 'printf [] --project='), d => d],
  ['removed TTL preflight validation call', s => s.replace('node "$repo_root/scripts/check-retention-active-evidence.mjs"', 'printf'), d => d],
  ['removed TTL preflight mode', s => s.replace('--mode preflight-ids', ''), d => d],
  ['removed validated ACTIVE policy skip', s => s.replace('if [[ " $already_active " == *" $group "* ]]; then', 'if false; then'), d => d],
  ['removed machine-readable policy ID capture', s => s.replace('already_active="$(node', 'disregard_active="$(node'), d => d],
];
const run = (script, document, cron = legacyCron) => {
  const tmp = mkdtempSync(join(tmpdir(), 'klar-ttl-regression-'));
  try {
    mkdirSync(join(tmp, 'scripts'));
    mkdirSync(join(tmp, 'docs'));
    mkdirSync(join(tmp, 'functions', 'src'), { recursive: true });
    writeFileSync(join(tmp, 'scripts/check-retention-matrix.mjs'), guard);
    writeFileSync(join(tmp, 'scripts/configure-retention.sh'), script);
    writeFileSync(join(tmp, 'docs/DATA_RETENTION.md'), document);
    writeFileSync(join(tmp, 'functions/src/deleteExpiredPhotos.ts'), cron);
    // The copied ESM script has no package.json; its .mjs extension suffices.
    return spawnSync(process.execPath, [join(tmp, 'scripts/check-retention-matrix.mjs')], { encoding: 'utf8', timeout: 10000 });
  } finally { rmSync(tmp, { recursive: true, force: true }); }
};
const valid = run(source, docs);
assert.equal(valid.status, 0, 'Canonical matrix unexpectedly rejected: ' + valid.stderr);
for (const [label, mutateScript, mutateDocs] of cases) {
  const modifiedSource = mutateScript(source);
  const modifiedDocs = mutateDocs(docs);
  assert(modifiedSource !== source || modifiedDocs !== docs, 'Mutation did not change input: ' + label);
  const result = run(modifiedSource, modifiedDocs);
  assert.notEqual(result.status, 0, 'Fail-open TTL matrix regression: ' + label);
}
const reenabledLegacyCron = legacyCron.replace(
  "info('verification_photo_retention_disabled'",
  "deleteExpiredPhotoPage(getMaintenanceBucket(), now);\\n  info('verification_photo_retention_disabled'",
);
assert.notEqual(reenabledLegacyCron, legacyCron, 'Legacy photo purge mutation was not applied');
const legacyResult = run(source, docs, reenabledLegacyCron);
assert.notEqual(legacyResult.status, 0, 'Fail-open legacy upload-age photo purge regression');
// Funnel cleanup is independent of verification-photo deletion and must not regress.
for (const [label, marker] of [
  ['funnel_events collection', "collection('funnel_events')"],
  ['expiresAt cutoff', "where('expiresAt', '<=', Timestamp.now())"],
  ['funnel retention audit marker', "'funnel_event_retention'"],
]) {
  const mutatedCron = legacyCron.replace(marker, 'REMOVED_FUNNEL_RETENTION_ASSERTION');
  assert.notEqual(mutatedCron, legacyCron, 'Funnel mutation was not applied: ' + label);
  const result = run(source, docs, mutatedCron);
  assert.notEqual(result.status, 0, 'Fail-open funnel retention regression: ' + label);
}
console.log('PASS: canonical 20-group TTL guard, ' + cases.length + ' TTL mutations and legacy photo purge hard-stop + 3 funnel-retention mutations (no cloud writes)');
