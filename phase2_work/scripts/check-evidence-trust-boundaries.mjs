import { readFile } from 'node:fs/promises';

const required = [
  ['scripts/validate-recovery-evidence.ts', ['KLAR_PROJECT_ID', 'FIRESTORE_DATABASE_ID', 'KLAR_BACKUP_BUCKET', 'KLAR_APPROVED_RPO_MINUTES', 'KLAR_APPROVED_RTO_MINUTES']],
  ['scripts/validate-load-cost-evidence.ts', ['KLAR_EVIDENCE_ENVIRONMENT', 'KLAR_EVIDENCE_HOSTS', 'KLAR_EVIDENCE_NOT_BEFORE', 'KLAR_EVIDENCE_NOT_AFTER', 'KLAR_APPROVED_MAX_COST_PER_1000_REQUESTS_USD']],
  ['scripts/promote-prod.sh', ['KLAR_PROMOTION_EVIDENCE', 'KLAR_EVIDENCE_ENVIRONMENT', 'KLAR_EVIDENCE_HOSTS', 'KLAR_EVIDENCE_NOT_BEFORE', 'KLAR_EVIDENCE_NOT_AFTER']],
];
const failures = [];
const releaseWorkflow = await readFile('.github/workflows/release.yml', 'utf8');
for (const token of ['container-tag-inspect.txt', 'write-container-tag-binding.mjs', 'container-tag-binding.json']) {
  if (!releaseWorkflow.includes(token)) failures.push(`release workflow: missing container tag binding ${token}`);
}

for (const [file, tokens] of required) {
  const text = await readFile(file, 'utf8');
  for (const token of tokens) if (!text.includes(token)) failures.push(`${file}: missing trusted context binding ${token}`);
}
const functionsIdentity = await readFile('scripts/write-functions-release-identity.mjs', 'utf8');
for (const token of ['packageLockSha256', 'compiledOutputSha256', 'headSha !== sha', 'tagSha !== sha']) {
  if (!functionsIdentity.includes(token)) failures.push(`functions release identity: missing ${token}`);
}
const promotion = await readFile('scripts/validate-promotion-evidence.mjs', 'utf8');
for (const token of ['schemaVersion !== 2', 'KLAR_EVIDENCE_ENVIRONMENT', 'KLAR_EVIDENCE_NOT_BEFORE', 'KLAR_EVIDENCE_NOT_AFTER', 'KLAR_EVIDENCE_HOSTS']) {
  if (!promotion.includes(token)) failures.push(`promotion validator: missing ${token}`);
}
const recovery = await readFile('src/server/platform/recoveryEvidence.ts', 'utf8');
for (const token of ['approvedRpoMinutes', 'approvedRtoMinutes', 'expectedDatabaseId']) {
  if (!recovery.includes(token)) failures.push(`recovery validator: missing ${token}`);
}
const load = await readFile('src/server/platform/loadCostEvidence.ts', 'utf8');
if (!load.includes('approvedMaxCostPer1000RequestsUsd')) failures.push('load/cost validator: missing trusted approved cost envelope');
if (failures.length) {
  console.error('Evidence trust-boundary gate FAILED:');
  for (const failure of failures) console.error('- ' + failure);
  process.exit(1);
}
console.log('Evidence trust-boundary gate PASS.');
