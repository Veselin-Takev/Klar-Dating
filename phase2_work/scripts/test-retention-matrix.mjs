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
const runbook = readFileSync(join(root, 'docs/PRODUCTION_RUNBOOK.md'), 'utf8');
const guard = readFileSync(join(root, 'scripts/check-retention-matrix.mjs'), 'utf8');
const cases = [
  ['stale 13-group runbook live evidence', s => s, d => d, r => r.replace('verify all 20 planned `expiresAt` TTL collection-group policies ACTIVE after independent approval', 'verify all 13 required `expiresAt` TTL policies ACTIVE')],
  ['stale 13-group runbook export evidence', s => s, d => d, r => r.replace('validates that all **20** planned `expiresAt` TTL policies are ACTIVE before exporting any file', 'validates that all **13** TTL policies are ACTIVE before exporting any file')],
  ['missing runbook legal disclaimer', s => s, d => d, r => r.replace('this technical validation is not a DPO/Legal approval or Production GO', 'a standalone production GO')],
  ['stale 13-group activation claim', s => s, d => d.replace('für alle 20 im Quellcode geplanten Collection Groups', 'für alle 13 dokumentierten Collection Groups')],
  ['stale 13-group staging ACTIVE claim', s => s, d => d.replace('Status `ACTIVE` aller 20 Gruppen', 'Status `ACTIVE` aller 13 Gruppen')],
  ['stale 13-group saved-evidence count', s => s, d => d.replace('Der Prüfer verlangt 20 distinct', 'Der Prüfer verlangt 13 distinct')],
  ['stale 13-group live-verification claim', s => s, d => d.replace('validates all 20 ACTIVE TTL fields', 'validates all 13 ACTIVE TTL fields')],
  ['missing explicit new-matrix legal approval caveat', s => s, d => d.replace('**keine** DPO-/Legal-Freigabe der erweiterten Matrix', 'DPO-/Legal-Freigabe der erweiterten Matrix')],
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
const run = (script, document, runbookDocument = runbook) => {
  const tmp = mkdtempSync(join(tmpdir(), 'klar-ttl-regression-'));
  try {
    mkdirSync(join(tmp, 'scripts'));
    mkdirSync(join(tmp, 'docs'));
    writeFileSync(join(tmp, 'scripts/check-retention-matrix.mjs'), guard);
    writeFileSync(join(tmp, 'scripts/configure-retention.sh'), script);
    writeFileSync(join(tmp, 'docs/DATA_RETENTION.md'), document);
    writeFileSync(join(tmp, 'docs/PRODUCTION_RUNBOOK.md'), runbookDocument);
    // The copied ESM script has no package.json; its .mjs extension suffices.
    return spawnSync(process.execPath, [join(tmp, 'scripts/check-retention-matrix.mjs')], { encoding: 'utf8', timeout: 10000 });
  } finally { rmSync(tmp, { recursive: true, force: true }); }
};
const valid = run(source, docs);
assert.equal(valid.status, 0, 'Canonical matrix unexpectedly rejected: ' + valid.stderr);
for (const [label, mutateScript, mutateDocs, mutateRunbook = value => value] of cases) {
  const modifiedSource = mutateScript(source);
  const modifiedDocs = mutateDocs(docs);
  const modifiedRunbook = mutateRunbook(runbook);
  assert(modifiedSource !== source || modifiedDocs !== docs || modifiedRunbook !== runbook, 'Mutation did not change input: ' + label);
  const result = run(modifiedSource, modifiedDocs, modifiedRunbook);
  assert.notEqual(result.status, 0, 'Fail-open TTL matrix regression: ' + label);
}
console.log('PASS: canonical 20-group TTL guard and ' + cases.length + ' fail-closed mutations (no cloud writes)');
