import fs from 'node:fs';
const route = fs.readFileSync('src/server/routes/complianceStorage.ts', 'utf8');
const fn = fs.readFileSync('functions/src/purgeVerificationStorage.ts', 'utf8');
const server = fs.readFileSync('server.ts', 'utf8');
const boundary = fs.readFileSync('src/server/platform/verificationPurgeBoundary.ts', 'utf8');
const checks = [
  ['protected purge endpoint', /purge-verification-storage/],
  ['environment secret', /COMPLIANCE_JOB_SECRET/],
  ['HMAC timing-safe validation', /timingSafeEqual/],
  ['30-day retention engine', /executeVerificationRetentionBatch/],
  ['verification path boundary', /startsWith\(`verification\/\$\{uid\}\/`\)/],
  ['daily scheduler', /schedule: '0 3 \* \* \*'/],
  ['single scheduler instance', /maxInstances: 1/],
  ['fresh authoritative decision before deletion', /assertCurrentVerificationPurgeCandidate\(current\.data\(\), artifact, now\)/],
  ['GCS metadata generation binding', /verifiedDeletionGeneration\(metadata, now\)/],
  ['GCS conditional object delete', /\.delete\(\{ ifGenerationMatch: generation \}\)/],
  ['reject old unversioned delete', /NEVER_REMOVE_MATCH_THIS_PATTERN/],
  ['hold and expiry enforcement', /metadata\?\.temporaryHold === true/],
  ['partial failure returns retryable status', /res\.status\(503\)\.json\(\{ ok: false, code: 'verification_storage_purge_incomplete'/],
  ['malformed due records block success', /malformedCount > 0/],
  ['HTTP summary counts avoid per-user data', /const safeSummary = \{/],
];
for (const [label, re] of checks) {
  if (label === 'reject old unversioned delete') {
    if (/\.delete\(\{ ignoreNotFound:\s*true \}\)/.test(route)) throw new Error('Compliance storage purge boundary failed: unversioned GCS deletion');
    continue;
  }
  const source = label === 'daily scheduler' || label === 'single scheduler instance' ? fn : label === 'protected purge endpoint' ? server + route : label === 'hold and expiry enforcement' ? boundary : route;
  if (!re.test(source)) throw new Error(`Compliance storage purge boundary failed: ${label}`);
}
console.log('Compliance storage purge boundary: PASS');
