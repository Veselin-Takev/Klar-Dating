import fs from 'node:fs';
const route = fs.readFileSync('src/server/routes/complianceStorage.ts', 'utf8');
const fn = fs.readFileSync('functions/src/purgeVerificationStorage.ts', 'utf8');
const server = fs.readFileSync('server.ts', 'utf8');
const checks = [
  ['protected purge endpoint', /purge-verification-storage/],
  ['environment secret', /COMPLIANCE_JOB_SECRET/],
  ['HMAC timing-safe validation', /timingSafeEqual/],
  ['30-day retention engine', /executeVerificationRetentionBatch/],
  ['temporary Storage hold guard', /isActiveOrMalformedHold\(metadata\.temporaryHold\)/],
  ['event-based Storage hold guard', /isActiveOrMalformedHold\(metadata\.eventBasedHold\)/],
  ['object retention expiration guard', /metadata\.retentionExpirationTime/],
  ['object retain-until guard', /metadata\.retention\?\.retainUntilTime/],
  ['legal hold on current Firestore decision', /'legalHold' in data && data\.legalHold !== false/],
  ['retention hold on current Firestore decision', /'retentionHold' in data && data\.retentionHold !== false/],
  ['generation-conditional delete', /file\.delete\(\{ ifGenerationMatch: generation \}\)/],
  ['resumable scanner', /scanPurgePages/],
  ['persisted deletion intent', /photoPurgeIntent/],
  ['verification path boundary', /startsWith\(`verification\/\$\{uid\}\/`\)/],
  ['daily scheduler', /schedule: '0 3 \* \* \*'/],
  ['single scheduler instance', /maxInstances: 1/],
];
for (const [label, re] of checks) {
  const source = label === 'daily scheduler' || label === 'single scheduler instance' ? fn : label === 'protected purge endpoint' ? server + route : route;
  if (!re.test(source)) throw new Error(`Compliance storage purge boundary failed: ${label}`);
}
// Never trust a generation first observed during deletion as original upload
// evidence. The guard must run at initial eligibility, in Firestore DELETE
// preflight, during 404 reconciliation, and in the final audit transaction.
for (const proof of [
  'requireVerifiedPhotoUploadGeneration(data);',
  'requireVerifiedPhotoUploadGeneration(record.data(), generation);',
  'requireVerifiedPhotoUploadGeneration(record.data(), intent.generation);',
  'requireVerifiedPhotoUploadGeneration(current.data(), proof.generation);',
]) {
  if (!route.includes(proof)) {
    throw new Error('Compliance storage purge boundary failed: original upload generation check missing');
  }
}
// A prior boolean completion flag cannot be acknowledged without coherent,
// original-generation-bound intent and audit proof. Missing legacy evidence
// must contribute to the aggregate failure count without retrying a DELETE.
for (const proof of [
  'export function hasVerifiedPhotoPurgeReceipt(',
  'requireVerifiedPhotoUploadGeneration(data, intent.generation)',
  'data.auditDigest !== expectedAuditDigest',
  'receipt.evidenceDigest === expectedEvidenceDigest',
  'data.photoPurged === true && !hasVerifiedPhotoPurgeReceipt(data, artifact, now)',
  'purgedAt < artifact.decidedAt || purgedAt > observedAt',
  'verifiedAt < purgedAt || verifiedAt > observedAt',
  'const invalid = docs.length - artifacts.length;',
  'failed: invalid + pendingOrFailed',
]) {
  if (!route.includes(proof)) {
    throw new Error('Compliance storage purge boundary failed: unverified completion receipt');
  }
}
// A bounded scanner can otherwise lose an earlier failure when a later
// request reaches the end of the cursor range with zero *new* failures.
// Persist the whole-sweep failure bit; never report a false HTTP 200.
for (const proof of [
  'const storedFailureState = state?.cycleHadFailures;',
  'storedFailureState === undefined && cursor !== null',
  "throw new Error('verification_purge_scan_failure_state_invalid');",
  'let invocationHadFailures = false;',
  'invocationHadFailures ||= invalid + pendingOrFailed > 0;',
  'cycleHadFailures: cursor === null',
  '(ownership.priorSweepFailures || invocationHadFailures)',
  'result.failed > 0 || result.hasMore || ownership.priorSweepFailures',
  'unresolvedEarlierPages: ownership.priorSweepFailures,',
]) {
  if (!route.includes(proof)) {
    throw new Error('Compliance storage purge boundary failed: cross-invocation failure evidence lost');
  }
}
// German legacy moderation and English status fields must not silently
// override each other. Conflicting states cannot authorize GCS DELETE,
// and cannot retroactively make a prior purge receipt look verified.
for (const proof of [
  'export function reconciledVerificationDecision(',
  "decision != null && status != null && read(decision) !== read(status)",
  'const status = reconciledVerificationDecision(data);',
  'reconciledVerificationDecision(data) !== artifact.status',
]) {
  if (!route.includes(proof)) {
    throw new Error('Compliance storage purge boundary failed: conflicting decision authority');
  }
}
console.log('Compliance storage purge boundary: PASS');
