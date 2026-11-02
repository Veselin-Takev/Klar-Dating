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
  ['GCS canonical uint64 generation bound', /!isCanonicalDeletionGeneration\(value\)/],
  ['GCS canonical bounded decimal regexp', /\^\[1-9\]\[0-9\]\{0,19\}\$/],
  ['GCS uint64 upper boundary', /18446744073709551615/],
  ['GCS conditional object delete', /\.delete\(\{ ifGenerationMatch: generation \}\)/],
  ['reject old unversioned delete', /NEVER_REMOVE_MATCH_THIS_PATTERN/],
  ['hold and expiry enforcement', /metadata\?\.temporaryHold === true/],
  ['GCS per-object retention gate', /Object\.hasOwn\(metadata, 'retention'\)/],
  ['GCS explicit expiration metadata validation', /Object\.hasOwn\(metadata, 'retentionExpirationTime'\)/],
  ['GCS per-object retention deadline', /\.retainUntilTime/],
  ['GCS ambiguous hold metadata gate', /Object\.hasOwn\(metadata, flag\)/],
  ['authoritative malformed hold flags fail-closed', /!hasUnambiguousVerificationHoldFlags\(current\)/],
  ['partial failure returns retryable status', /res\.status\(503\)\.json\(\{ ok: false, code: 'verification_storage_purge_incomplete'/],
  ['malformed due records block success', /malformedCount > 0/],
  ['HTTP summary counts avoid per-user data', /const safeSummary = \{/],
  ['bounded due scan', /const MAX_SCAN_PAGES = 3/],
  ['ordered due query', /\.orderBy\('fotoLoeschenAb'\)/],
  ['page cursor before physical delete', /dueQuery\.startAfter\(cursor\)\.limit\(MAX_BATCH\)/],
  ['reject unscanned due records', /verification_storage_purge_scan_incomplete/],
  ['fail closed preflight before GCS use', /verification_storage_purge_preflight_failed/],
  ['duplicate object path rejection', /usedPaths\.has\(artifact\.storagePath\)/],
  ['preflight verifies each snapshot', /assertCurrentVerificationPurgeCandidate\(sourceDocument\.data\(\), artifact, now\)/],
];
for (const [label, re] of checks) {
  if (label === 'reject old unversioned delete') {
    if (/\.delete\(\{ ignoreNotFound:\s*true \}\)/.test(route)) throw new Error('Compliance storage purge boundary failed: unversioned GCS deletion');
    continue;
  }
  const source = label === 'daily scheduler' || label === 'single scheduler instance' ? fn : label === 'protected purge endpoint' ? server + route : label === 'hold and expiry enforcement' || label.startsWith('GCS per-object retention') || label === 'GCS explicit expiration metadata validation' || label === 'GCS ambiguous hold metadata gate' ||
    label === 'authoritative malformed hold flags fail-closed' ||
    label.startsWith('GCS canonical') ||
    label === 'GCS uint64 upper boundary' ? boundary : route;
  if (!re.test(source)) throw new Error(`Compliance storage purge boundary failed: ${label}`);
}
console.log('Compliance storage purge boundary: PASS');
