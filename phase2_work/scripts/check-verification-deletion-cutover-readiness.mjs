import { createHash, timingSafeEqual } from 'node:crypto';
import { lstatSync, readFileSync, realpathSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const VERDICT = Object.freeze({
  ELIGIBLE: 'ELIGIBLE_FOR_INDEPENDENT_REVIEW',
  BLOCKED: 'BLOCKED',
});

export const EXPECTED_BASELINE = Object.freeze({
  mainSha: '2854162816037486031cec8fb169ccda1a10deaa',
  mainTreeSha: '59d93e346cb5805ba8efaf57d076af93f30beab2',
  sourceBlobShas: Object.freeze({
  "writer": "11ecd1ca9837d7c153137393c21c44f69f806215",
  "writerTests": "eba4a6152f31892dfa8974ebec3bc43c9a9cf5ee",
  "inventory": "021c7a1dd8e154fbecffcc53fba7348285136b53",
  "klarCore": "22e0b0c90cf53250872fb3771625f7016c7db600",
  "registration": "7c414cd27fa7310237b3eee85973e7e370cab9e9",
  "fence": "6c755d8874ba8af982cc6dff989d8ed1c5609f6d",
  "accountDeletion": "818db861a5847b1931eb80d86accaaea5bb58424",
  "trustSafety": "fef21dfb13f61e32f9ef5e29d69be3e3caaadfaa",
  "retention": "45c2b5a0dc8921ee1ee70b9b00467acce879733d",
  "compliance": "8951bb19546b8c668c340370d878d9ed34f20b87"
}),
});

const REQUIRED_SOURCE_IDS = Object.freeze(Object.keys(EXPECTED_BASELINE.sourceBlobShas));
const EXTERNAL_CATEGORIES = Object.freeze([
  'IAM_SERVICE_ACCOUNTS',
  'EXTERNAL_ADMIN_SDK_AND_SIGNED_URLS',
  'BUCKET_LIFECYCLE_RETENTION_SOFT_DELETE_HOLDS',
  'DEPLOYED_FINALIZE_TRIGGER_AND_SCHEDULER',
  'DPO_LEGAL_HOLD_MODERATION_APPEAL_QUARANTINE_ART17',
  'SRE_RECOVERY_MONITORING_ROLLBACK_INCIDENT',
]);
const REQUIRED_REVIEW_ROLES = Object.freeze(['APPSEC', 'DPO_LEGAL', 'SRE']);
const OPTIONAL_REVIEW_ROLE = 'RELEASE_OWNER';
const HEX40 = /^[a-f0-9]{40}$/i;
const HEX64 = /^[a-f0-9]{64}$/i;
const isRecord = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const nonempty = value => typeof value === 'string' && value.trim().length > 0;
const validIso = value => typeof value === 'string'
  && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2})$/.test(value)
  && Number.isFinite(Date.parse(value));
const sha256 = value => createHash('sha256').update(value).digest('hex');

function canonical(value) {
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  if (isRecord(value)) {
    return '{' + Object.keys(value).sort().map(key => JSON.stringify(key) + ':' + canonical(value[key])).join(',') + '}';
  }
  return JSON.stringify(value);
}

export function computeEvidenceDigest(manifest) {
  if (!isRecord(manifest)) throw new Error('manifest must be an object');
  const unsigned = { ...manifest };
  delete unsigned.approvals;
  delete unsigned.evidenceDigest;
  return sha256(canonical(unsigned));
}

export function gitBlobSha(content) {
  const bytes = Buffer.isBuffer(content) ? content : Buffer.from(content);
  return createHash('sha1')
    .update(Buffer.from('blob ' + bytes.length + '\0'))
    .update(bytes)
    .digest('hex');
}

function safeEvidencePath(root, relativePath) {
  if (!nonempty(relativePath) || path.isAbsolute(relativePath)) {
    throw new Error('evidence path must be non-empty and relative');
  }
  const parts = relativePath.split(/[\\/]+/);
  if (parts.some(part => !part || part === '.' || part === '..')) {
    throw new Error('evidence path traversal or empty segment rejected');
  }
  const rootReal = realpathSync(root);
  let cursor = rootReal;
  for (const part of parts) {
    cursor = path.join(cursor, part);
    const stat = lstatSync(cursor);
    if (stat.isSymbolicLink()) throw new Error('symlink evidence is not allowed');
  }
  const resolved = realpathSync(cursor);
  const relative = path.relative(rootReal, resolved);
  if (!relative || relative === '..' || relative.startsWith('..' + path.sep) || path.isAbsolute(relative)) {
    throw new Error('evidence path escapes evidence root');
  }
  const stat = lstatSync(resolved);
  if (!stat.isFile() || stat.size > 5 * 1024 * 1024) {
    throw new Error('evidence artifact must be a regular file <= 5 MiB');
  }
  return resolved;
}

function readArtifact(root, artifact, errors, label) {
  try {
    return readFileSync(safeEvidencePath(root, artifact.path));
  } catch (error) {
    errors.push(label + ' artifact cannot be read safely: ' + error.message);
    return null;
  }
}

function verifyArtifacts(manifest, evidenceDirectory, expectedSourceBlobShas, errors) {
  const result = new Map();
  if (!Array.isArray(manifest.evidenceArtifacts) || manifest.evidenceArtifacts.length < REQUIRED_SOURCE_IDS.length
      || manifest.evidenceArtifacts.length > 100) {
    errors.push('evidenceArtifacts must contain all required source artifacts and no more than 100 records');
    return result;
  }
  const paths = new Set();
  for (const [index, artifact] of manifest.evidenceArtifacts.entries()) {
    const label = 'evidenceArtifacts[' + index + ']';
    if (!isRecord(artifact) || !nonempty(artifact.id) || result.has(artifact.id)
        || !nonempty(artifact.path) || paths.has(artifact.path)) {
      errors.push(label + ' requires a unique artifact id and relative path');
      continue;
    }
    result.set(artifact.id, artifact);
    paths.add(artifact.path);
    if (!HEX64.test(artifact.sha256 || '') || !HEX40.test(artifact.gitBlobSha || '')) {
      errors.push(label + ' requires valid SHA-256 and Git-Blob-SHA-1');
      continue;
    }
    const body = readArtifact(evidenceDirectory, artifact, errors, label);
    if (!body) continue;
    const actual256 = sha256(body);
    const actualBlob = gitBlobSha(body);
    const expected256 = Buffer.from(artifact.sha256, 'hex');
    const actual256Bytes = Buffer.from(actual256, 'hex');
    if (expected256.length !== actual256Bytes.length || !timingSafeEqual(expected256, actual256Bytes)) {
      errors.push(label + ' SHA-256 mismatch');
    }
    if (actualBlob !== artifact.gitBlobSha) errors.push(label + ' Git-Blob-SHA-1 mismatch');
    const pinned = expectedSourceBlobShas[artifact.id];
    if (pinned && artifact.gitBlobSha !== pinned) errors.push(label + ' source Blob SHA differs from the pinned main baseline');
  }
  for (const id of REQUIRED_SOURCE_IDS) {
    if (!result.has(id)) errors.push('required main source artifact missing: ' + id);
  }
  return result;
}

function requireSourceText(artifacts, evidenceDirectory, id, snippets, errors) {
  const artifact = artifacts.get(id);
  if (!artifact) return;
  const body = readArtifact(evidenceDirectory, artifact, errors, id);
  if (!body) return;
  const text = body.toString('utf8');
  for (const snippet of snippets) {
    if (!text.includes(snippet)) errors.push(id + ' does not contain required boundary evidence: ' + snippet);
  }
}

function checkBaseline(manifest, expectedMainSha, expectedMainTreeSha, expectedSourceBlobShas, artifacts, errors) {
  const baseline = manifest.baseline;
  if (!isRecord(baseline)) {
    errors.push('exact verified main baseline is required');
    return;
  }
  if (expectedMainSha !== EXPECTED_BASELINE.mainSha || baseline.mainSha !== EXPECTED_BASELINE.mainSha
      || baseline.mainSha !== expectedMainSha || !HEX40.test(baseline.mainSha || '')) {
    errors.push('main SHA is missing or differs from the pinned verified baseline');
  }
  if (expectedMainTreeSha !== EXPECTED_BASELINE.mainTreeSha || baseline.mainTreeSha !== EXPECTED_BASELINE.mainTreeSha
      || baseline.mainTreeSha !== expectedMainTreeSha || !HEX40.test(baseline.mainTreeSha || '')) {
    errors.push('main Tree SHA is missing or differs from the pinned verified baseline');
  }
  for (const id of REQUIRED_SOURCE_IDS) {
    if (baseline.sourceBlobShas?.[id] !== expectedSourceBlobShas[id] || !artifacts.has(id)
        || artifacts.get(id)?.gitBlobSha !== expectedSourceBlobShas[id]) {
      errors.push('baseline source Blob SHA missing or mismatched: ' + id);
    }
  }
}

function checkPackage1(manifest, artifacts, errors) {
  const package1 = manifest.package1;
  if (!isRecord(package1) || package1.status !== 'VERIFIED_MAINLINE'
      || package1.integrationCommitSha !== EXPECTED_BASELINE.mainSha
      || package1.writerBoundary?.verdict !== 'PASS'
      || package1.writerBoundary?.sourceFilesScanned !== 135
      || package1.writerBoundary?.testsPassed !== 8
      || package1.writerBoundary?.testsFailed !== 0
      || package1.writerBoundary?.ciRunId !== 45245284270) {
    errors.push('Package 1 must bind the post-merge #409 baseline and exact 135-file / 8-of-8 hosted gate evidence');
  }
  for (const id of ['writer', 'writerTests', 'inventory']) {
    if (!artifacts.has(id)) errors.push('Package 1 source inventory/static boundary artifact missing: ' + id);
  }
}

function checkHardStops(artifacts, evidenceDirectory, manifest, errors) {
  const proof = manifest.hardStops;
  if (!isRecord(proof) || proof.accountErasure?.status !== 'VERIFIED_DEFAULT_PROFILE_ONLY'
      || proof.accountErasure?.sourceArtifactId !== 'accountDeletion'
      || proof.accountErasure?.retentionArtifactId !== 'retention'
      || proof.accountErasure?.trustSafetyArtifactId !== 'trustSafety'
      || proof.compliancePurge?.status !== 'VERIFIED_PRODUCTION_503'
      || proof.compliancePurge?.sourceArtifactId !== 'compliance'
      || proof.compliancePurge?.expectedStatus !== 503) {
    errors.push('profile-only account-erasure hard-stop and production 503 interlock evidence are mandatory');
  }
  requireSourceText(artifacts, evidenceDirectory, 'accountDeletion',
    ['assertNoVerificationDeletionArtifacts', 'VERIFICATION_DELETION_WRITER_INTENT_COLLECTION'], errors);
  requireSourceText(artifacts, evidenceDirectory, 'trustSafety', ['deleteAccountPhotos'], errors);
  requireSourceText(artifacts, evidenceDirectory, 'retention',
    ["mode: 'profile-only'", 'assertNoUnfencedVerificationPhotos', 'ifGenerationMatch'], errors);
  requireSourceText(artifacts, evidenceDirectory, 'compliance',
    ["process.env.NODE_ENV === 'production'", 'verification_storage_purge_p0_fencing_unverified', 'return res.status(503)'], errors);
}

function checkWriterFence(artifacts, evidenceDirectory, errors) {
  requireSourceText(artifacts, evidenceDirectory, 'klarCore',
    ['beginVerificationDeletionWriterIntent', 'completeVerificationDeletionWriterIntent', 'metageneration'], errors);
  requireSourceText(artifacts, evidenceDirectory, 'registration',
    ['registerFinalizedVerificationObject', 'ensureVerificationDeletionFenceForUploadedObject'], errors);
  requireSourceText(artifacts, evidenceDirectory, 'fence',
    ['VERIFICATION_DELETION_WRITER_INTENT_COLLECTION', 'prepareVerificationDeleteCas', 'beginVerificationDeletionHold'], errors);
}

function checkExternalEvidence(manifest, artifacts, errors) {
  if (!Array.isArray(manifest.externalEvidence) || manifest.externalEvidence.length !== EXTERNAL_CATEGORIES.length) {
    errors.push('all six external and policy evidence categories must be supplied exactly once');
    return;
  }
  const seen = new Set();
  for (const [index, item] of manifest.externalEvidence.entries()) {
    const label = 'externalEvidence[' + index + ']';
    if (!isRecord(item) || !EXTERNAL_CATEGORIES.includes(item.category) || seen.has(item.category)) {
      errors.push(label + ' category is invalid or duplicated');
      continue;
    }
    seen.add(item.category);
    if (item.status !== 'VERIFIED' || !nonempty(item.evidenceRef) || !artifacts.has(item.evidenceRef)
        || !nonempty(item.owner) || !validIso(item.timestamp)) {
      errors.push(label + ' must be VERIFIED with an artifact reference, accountable owner and valid timestamp');
    }
  }
  for (const category of EXTERNAL_CATEGORIES) if (!seen.has(category)) errors.push('missing external evidence category: ' + category);
}

function checkApprovals(manifest, now, errors) {
  if (!Array.isArray(manifest.approvals) || manifest.approvals.length < 3 || manifest.approvals.length > 4) {
    errors.push('exactly three required independent approvals and at most one RELEASE_OWNER approval are permitted');
    return;
  }
  const roles = new Set();
  const signers = new Set();
  for (const [index, approval] of manifest.approvals.entries()) {
    const label = 'approvals[' + index + ']';
    if (!isRecord(approval) || !['APPSEC', 'DPO_LEGAL', 'SRE', OPTIONAL_REVIEW_ROLE].includes(approval.role)
        || roles.has(approval.role)) {
      errors.push(label + ' role is invalid or duplicated');
      continue;
    }
    roles.add(approval.role);
    if (!nonempty(approval.signerRef) || signers.has(approval.signerRef)
        || !nonempty(approval.reviewerIdentityClaim)) {
      errors.push(label + ' reviewer identity claim and distinct signer reference are required');
    }
    signers.add(approval.signerRef);
    if (approval.decision !== 'APPROVED' || approval.scope !== 'P0_371_PACKAGE_2_OFFLINE_CUTOVER_READINESS'
        || !validIso(approval.signedAt) || !validIso(approval.expiresAt)
        || Date.parse(approval.expiresAt) <= now
        || approval.evidenceDigest !== manifest.evidenceDigest) {
      errors.push(label + ' approval must be current, in-scope, APPROVED and bound to the exact evidence digest');
    }
  }
  for (const role of REQUIRED_REVIEW_ROLES) if (!roles.has(role)) errors.push('missing required independent reviewer role: ' + role);
}

export function validateVerificationDeletionCutoverReadiness({
  manifest,
  evidenceDirectory,
  expectedMainSha = EXPECTED_BASELINE.mainSha,
  expectedMainTreeSha = EXPECTED_BASELINE.mainTreeSha,
  expectedSourceBlobShas = EXPECTED_BASELINE.sourceBlobShas,
  now = Date.now(),
} = {}) {
  const errors = [];
  if (!isRecord(manifest)) {
    return Object.freeze({ verdict: VERDICT.BLOCKED, blockers: Object.freeze(['manifest must be a JSON object']) });
  }
  if (manifest.schemaVersion !== 1) errors.push('schemaVersion must equal 1');
  if (!nonempty(evidenceDirectory)) errors.push('local evidence directory is required; validator is offline only');
  let artifacts = new Map();
  if (nonempty(evidenceDirectory)) {
    try {
      artifacts = verifyArtifacts(manifest, evidenceDirectory, expectedSourceBlobShas, errors);
    } catch (error) {
      errors.push('evidence directory cannot be verified: ' + error.message);
    }
  }
  checkBaseline(manifest, expectedMainSha, expectedMainTreeSha, expectedSourceBlobShas, artifacts, errors);
  checkPackage1(manifest, artifacts, errors);
  checkWriterFence(artifacts, evidenceDirectory, errors);
  checkHardStops(artifacts, evidenceDirectory, manifest, errors);
  checkExternalEvidence(manifest, artifacts, errors);
  if (!HEX64.test(manifest.evidenceDigest || '') || manifest.evidenceDigest !== computeEvidenceDigest(manifest)) {
    errors.push('evidence digest is missing or mismatched');
  }
  checkApprovals(manifest, now, errors);
  const operations = manifest.operations;
  if (!isRecord(operations) || operations.storageMutations !== 0 || operations.firestoreWrites !== 0
      || operations.cloudOperations !== 0 || operations.deployments !== 0) {
    errors.push('all four operation counters must be explicitly zero');
  }
  return Object.freeze({
    verdict: errors.length === 0 ? VERDICT.ELIGIBLE : VERDICT.BLOCKED,
    blockers: Object.freeze(errors),
  });
}

export function policyCheck() {
  if (VERDICT.ELIGIBLE !== 'ELIGIBLE_FOR_INDEPENDENT_REVIEW' || VERDICT.BLOCKED !== 'BLOCKED'
      || Object.values(VERDICT).length !== 2 || 'PRODUCTION_APPROVED' in VERDICT) {
    throw new Error('verdict policy must expose only BLOCKED and ELIGIBLE_FOR_INDEPENDENT_REVIEW');
  }
  return true;
}

function parseArgs(argv) {
  const args = new Map();
  const allowed = new Set(['--manifest', '--evidence-dir', '--expected-main-sha', '--expected-main-tree-sha']);
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index];
    const value = argv[index + 1];
    if (!allowed.has(key) || !nonempty(value) || value.startsWith('--') || args.has(key)) {
      throw new Error('invalid, duplicate or incomplete CLI argument: ' + key);
    }
    args.set(key, value);
  }
  for (const key of allowed) if (!args.has(key)) throw new Error('required CLI argument missing: ' + key);
  return args;
}

function runCli() {
  try {
    if (process.argv.slice(2).length === 1 && process.argv[2] === '--policy-check') {
      policyCheck();
      process.stdout.write('Verification deletion cutover policy: PASS (no operational evidence evaluated; operational verdict remains BLOCKED)\\n');
      return;
    }
    const args = parseArgs(process.argv.slice(2));
    const manifestPath = path.resolve(args.get('--manifest'));
    const evidenceDirectory = path.resolve(args.get('--evidence-dir'));
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
    const result = validateVerificationDeletionCutoverReadiness({
      manifest,
      evidenceDirectory,
      expectedMainSha: args.get('--expected-main-sha'),
      expectedMainTreeSha: args.get('--expected-main-tree-sha'),
    });
    process.stdout.write(JSON.stringify(result, null, 2) + '\\n');
    if (result.verdict === VERDICT.BLOCKED) process.exitCode = 1;
  } catch (error) {
    process.stderr.write('BLOCKED: ' + error.message + '\\n');
    process.exitCode = 1;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) runCli();
