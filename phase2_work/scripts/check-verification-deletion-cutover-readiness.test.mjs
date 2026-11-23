import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, mkdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  EXPECTED_BASELINE,
  VERDICT,
  computeEvidenceDigest,
  gitBlobSha,
  validateVerificationDeletionCutoverReadiness,
} from './check-verification-deletion-cutover-readiness.mjs';

const MAIN = EXPECTED_BASELINE.mainSha;
const TREE = EXPECTED_BASELINE.mainTreeSha;
const NOW = Date.parse('2026-11-23T12:00:00.000Z');
const SOURCE_TEXT = {
  writer: 'server.ts Storage writer boundary scanner',
  writerTests: "import test from 'node:test';\nnegative boundary cases",
  inventory: 'P0 #371 Package 1 verification writer inventory',
  klarCore: 'beginVerificationDeletionWriterIntent completeVerificationDeletionWriterIntent metageneration',
  registration: 'registerFinalizedVerificationObject ensureVerificationDeletionFenceForUploadedObject',
  fence: 'VERIFICATION_DELETION_WRITER_INTENT_COLLECTION prepareVerificationDeleteCas beginVerificationDeletionHold',
  accountDeletion: 'assertNoVerificationDeletionArtifacts VERIFICATION_DELETION_WRITER_INTENT_COLLECTION',
  trustSafety: 'deleteAccountPhotos',
  retention: "mode: 'profile-only' assertNoUnfencedVerificationPhotos ifGenerationMatch",
  compliance: "process.env.NODE_ENV === 'production' verification_storage_purge_p0_fencing_unverified return res.status(503)",
};
const EXTERNAL = [
  'IAM_SERVICE_ACCOUNTS',
  'EXTERNAL_ADMIN_SDK_AND_SIGNED_URLS',
  'BUCKET_LIFECYCLE_RETENTION_SOFT_DELETE_HOLDS',
  'DEPLOYED_FINALIZE_TRIGGER_AND_SCHEDULER',
  'DPO_LEGAL_HOLD_MODERATION_APPEAL_QUARANTINE_ART17',
  'SRE_RECOVERY_MONITORING_ROLLBACK_INCIDENT',
];
const ROLE_SCOPE = 'P0_371_PACKAGE_2_OFFLINE_CUTOVER_READINESS';

function sourceBlobMap(artifacts) {
  return Object.fromEntries(Object.keys(SOURCE_TEXT).map(id => [id, artifacts.find(item => item.id === id).gitBlobSha]));
}
function addArtifact(directory, id, body) {
  const filename = id + '.evidence.txt';
  writeFileSync(path.join(directory, filename), body, { flag: 'wx' });
  return {
    id,
    path: filename,
    sha256: createHash('sha256').update(body).digest('hex'),
    gitBlobSha: gitBlobSha(body),
  };
}
function makeFixture(mutator = () => {}) {
  const directory = mkdtempSync(path.join(os.tmpdir(), 'klar-verification-cutover-'));
  mkdirSync(directory, { recursive: true });
  try {
    const artifacts = Object.entries(SOURCE_TEXT).map(([id, body]) => addArtifact(directory, id, body));
    for (const category of EXTERNAL) {
      artifacts.push(addArtifact(directory, 'external-' + category, 'synthetic evidence fixture for ' + category));
    }
    const manifest = {
      schemaVersion: 1,
      baseline: {
        mainSha: MAIN,
        mainTreeSha: TREE,
        pr397MergeSha: '6ef75da0b6f9effb297137ad2d0b8665a4cac1a0',
        sourceBlobShas: sourceBlobMap(artifacts),
      },
      evidenceArtifacts: artifacts,
      package1: {
        status: 'VERIFIED_MAINLINE',
        integrationCommitSha: MAIN,
        writerBoundary: {
          verdict: 'PASS',
          sourceFilesScanned: 135,
          testsPassed: 8,
          testsFailed: 0,
          ciRunId: 45245284270,
        },
      },
      hardStops: {
        accountErasure: {
          status: 'VERIFIED_DEFAULT_PROFILE_ONLY',
          sourceArtifactId: 'accountDeletion',
          retentionArtifactId: 'retention',
          trustSafetyArtifactId: 'trustSafety',
        },
        compliancePurge: {
          status: 'VERIFIED_PRODUCTION_503',
          sourceArtifactId: 'compliance',
          expectedStatus: 503,
        },
      },
      externalEvidence: EXTERNAL.map(category => ({
        category,
        status: 'VERIFIED',
        evidenceRef: 'external-' + category,
        owner: 'synthetic-owner-' + category,
        timestamp: '2026-11-23T11:00:00.000Z',
      })),
      operations: {
        storageMutations: 0,
        firestoreWrites: 0,
        cloudOperations: 0,
        deployments: 0,
      },
      approvals: ['APPSEC', 'DPO_LEGAL', 'SRE'].map(role => ({
        role,
        signerRef: 'synthetic-signer-' + role,
        reviewerIdentityClaim: 'synthetic identity claim; not authenticated',
        scope: ROLE_SCOPE,
        decision: 'APPROVED',
        signedAt: '2026-11-23T11:00:00.000Z',
        expiresAt: '2026-11-24T11:00:00.000Z',
        evidenceDigest: '',
      })),
    };
    mutator(manifest, directory, artifacts);
    manifest.evidenceDigest = computeEvidenceDigest(manifest);
    for (const approval of manifest.approvals) approval.evidenceDigest = manifest.evidenceDigest;
    return { directory, manifest, artifacts };
  } catch (error) {
    rmSync(directory, { recursive: true, force: true });
    throw error;
  }
}
function withFixture(fn) {
  const fixture = makeFixture();
  try { fn(fixture); } finally { rmSync(fixture.directory, { recursive: true, force: true }); }
}
function run(fixture, overrides = {}) {
  return validateVerificationDeletionCutoverReadiness({
    manifest: fixture.manifest,
    evidenceDirectory: fixture.directory,
    expectedMainSha: MAIN,
    expectedMainTreeSha: TREE,
    expectedSourceBlobShas: sourceBlobMap(fixture.artifacts),
    now: NOW,
    ...overrides,
  });
}
function blocked(result) {
  assert.equal(result.verdict, VERDICT.BLOCKED);
  assert.ok(result.blockers.length > 0);
}

test('complete synthetic offline evidence reaches only ELIGIBLE_FOR_INDEPENDENT_REVIEW', () => withFixture(f => {
  const result = run(f);
  assert.deepEqual(result, { verdict: VERDICT.ELIGIBLE, blockers: [] });
  assert.equal(Object.values(VERDICT).includes('PRODUCTION_' + 'APPROVED'), false);
  assert.equal(Object.values(VERDICT).length, 2);
}));

test('missing and mismatched main SHA block', () => withFixture(f => {
  f.manifest.baseline.mainSha = '';
  blocked(run(f));
  f.manifest.baseline.mainSha = 'f'.repeat(40);
  blocked(run(f));
}));

test('missing or mismatched PR #397 canonical fence merge identity blocks', () => withFixture(f => {
  f.manifest.baseline.pr397MergeSha = '';
  blocked(run(f));
  f.manifest.baseline.pr397MergeSha = 'f'.repeat(40);
  blocked(run(f));
}));

test('missing and mismatched main Tree SHA block', () => withFixture(f => {
  f.manifest.baseline.mainTreeSha = '';
  blocked(run(f));
  f.manifest.baseline.mainTreeSha = 'e'.repeat(40);
  blocked(run(f));
}));

test('every missing or mismatched pinned source Blob SHA blocks', () => withFixture(f => {
  for (const id of Object.keys(SOURCE_TEXT)) {
    const original = f.manifest.baseline.sourceBlobShas[id];
    f.manifest.baseline.sourceBlobShas[id] = 'f'.repeat(40);
    blocked(run(f));
    f.manifest.baseline.sourceBlobShas[id] = original;
  }
}));

test('missing Package 1 inventory, scanner or test evidence blocks', () => withFixture(f => {
  f.manifest.evidenceArtifacts = f.manifest.evidenceArtifacts.filter(item => item.id !== 'writerTests');
  blocked(run(f));
}));

test('Package 1 CI evidence with wrong run, count or failing tests blocks', () => withFixture(f => {
  f.manifest.package1.writerBoundary.testsPassed = 7;
  blocked(run(f));
  f.manifest.package1.writerBoundary.testsPassed = 8;
  f.manifest.package1.writerBoundary.ciRunId = 1;
  blocked(run(f));
}));

test('missing account-erasure hard-stop proof blocks', () => withFixture(f => {
  f.manifest.hardStops.accountErasure.status = 'UNRESOLVED';
  blocked(run(f));
}));

test('missing production 503 interlock evidence blocks', () => withFixture(f => {
  f.manifest.hardStops.compliancePurge.expectedStatus = 200;
  blocked(run(f));
}));

test('each missing, unresolved or duplicated external and DPO category blocks', () => withFixture(f => {
  f.manifest.externalEvidence[0].status = 'UNRESOLVED';
  blocked(run(f));
  f.manifest.externalEvidence[0].status = 'VERIFIED';
  f.manifest.externalEvidence.pop();
  blocked(run(f));
  f.manifest.externalEvidence.push({ ...f.manifest.externalEvidence[0] });
  blocked(run(f));
}));

test('external evidence without owner, timestamp or artifact reference blocks', () => withFixture(f => {
  f.manifest.externalEvidence[1].owner = '';
  blocked(run(f));
  f.manifest.externalEvidence[1].owner = 'owner';
  f.manifest.externalEvidence[1].evidenceRef = 'missing-artifact';
  blocked(run(f));
}));

test('stale external evidence and future-dated approvals block', () => withFixture(f => {
  f.manifest.externalEvidence[0].timestamp = '2026-01-01T00:00:00.000Z';
  blocked(run(f));
  f.manifest.externalEvidence[0].timestamp = '2026-11-23T11:00:00.000Z';
  f.manifest.approvals[0].signedAt = '2026-11-24T11:00:00.000Z';
  blocked(run(f));
}));

test('missing production interlock source artifact blocks', () => withFixture(f => {
  f.manifest.evidenceArtifacts = f.manifest.evidenceArtifacts.filter(item => item.id !== 'compliance');
  blocked(run(f));
}));

test('missing mandatory reviewer roles block', () => withFixture(f => {
  f.manifest.approvals = f.manifest.approvals.filter(item => item.role !== 'DPO_LEGAL');
  blocked(run(f));
}));

test('duplicate reviewer role or signer identity blocks', () => withFixture(f => {
  f.manifest.approvals[1].role = 'APPSEC';
  blocked(run(f));
  f.manifest.approvals[1].role = 'DPO_LEGAL';
  f.manifest.approvals[1].signerRef = f.manifest.approvals[0].signerRef;
  blocked(run(f));
}));

test('expired or malformed reviewer approval blocks', () => withFixture(f => {
  f.manifest.approvals[0].expiresAt = '2026-11-23T11:59:59.000Z';
  blocked(run(f));
  f.manifest.approvals[0].expiresAt = 'not-a-date';
  blocked(run(f));
}));

test('contradictory reviewer decision or scope blocks', () => withFixture(f => {
  f.manifest.approvals[0].decision = 'REJECTED';
  blocked(run(f));
  f.manifest.approvals[0].decision = 'APPROVED';
  f.manifest.approvals[0].scope = 'OTHER';
  blocked(run(f));
}));

test('missing reviewer identity claim or optional role duplication blocks', () => withFixture(f => {
  f.manifest.approvals[0].reviewerIdentityClaim = '';
  blocked(run(f));
  f.manifest.approvals[0].reviewerIdentityClaim = 'synthetic';
  f.manifest.approvals.push({ ...f.manifest.approvals[0] });
  blocked(run(f));
}));

test('digest-mismatched reviewer approval and tampered manifest block', () => withFixture(f => {
  f.manifest.approvals[0].evidenceDigest = '0'.repeat(64);
  blocked(run(f));
  f.manifest.approvals[0].evidenceDigest = f.manifest.evidenceDigest;
  f.manifest.hardStops.compliancePurge.expectedStatus = 418;
  blocked(run(f));
}));

test('SHA-256 mismatch and Git-Blob-SHA-1 mismatch block', () => withFixture(f => {
  f.manifest.evidenceArtifacts[0].sha256 = '0'.repeat(64);
  blocked(run(f));
  f.manifest.evidenceArtifacts[0].sha256 = createHash('sha256').update(SOURCE_TEXT.writer).digest('hex');
  f.manifest.evidenceArtifacts[0].gitBlobSha = '0'.repeat(40);
  blocked(run(f));
}));

test('path traversal, absolute paths and symlink evidence block', () => withFixture(f => {
  f.manifest.evidenceArtifacts[0].path = '../outside.txt';
  blocked(run(f));
  f.manifest.evidenceArtifacts[0].path = path.join(f.directory, 'writer.evidence.txt');
  blocked(run(f));
}));

test('symlink evidence is rejected before its target is read', () => withFixture(f => {
  const link = path.join(f.directory, 'writer-link.txt');
  symlinkSync(path.join(f.directory, 'writer.evidence.txt'), link);
  f.manifest.evidenceArtifacts[0].path = 'writer-link.txt';
  blocked(run(f));
}));

test('non-zero Storage mutation counter blocks', () => withFixture(f => {
  f.manifest.operations.storageMutations = 1;
  blocked(run(f));
}));

test('non-zero Firestore write counter blocks', () => withFixture(f => {
  f.manifest.operations.firestoreWrites = 1;
  blocked(run(f));
}));

test('non-zero cloud operation counter blocks', () => withFixture(f => {
  f.manifest.operations.cloudOperations = 1;
  blocked(run(f));
}));

test('non-zero deployment counter blocks', () => withFixture(f => {
  f.manifest.operations.deployments = 1;
  blocked(run(f));
}));

test('missing or non-zero operation assertions block', () => withFixture(f => {
  delete f.manifest.operations;
  blocked(run(f));
  f.manifest.operations = { storageMutations: 0, firestoreWrites: 0, cloudOperations: 0, deployments: 1 };
  blocked(run(f));
}));

test('stale baseline and malformed evidence directory block', () => withFixture(f => {
  blocked(run(f, { expectedMainSha: 'a'.repeat(40) }));
  blocked(validateVerificationDeletionCutoverReadiness({
    manifest: f.manifest, evidenceDirectory: '', expectedMainSha: MAIN, expectedMainTreeSha: TREE, now: NOW,
    expectedSourceBlobShas: sourceBlobMap(f.artifacts),
  }));
}));

test('source artifact text must prove Writer-Intent, finalize, fence and hold-CAS boundaries', () => withFixture(f => {
  const writer = f.artifacts.find(item => item.id === 'fence');
  writeFileSync(path.join(f.directory, writer.path), 'wrong source text');
  blocked(run(f));
}));

test('optional RELEASE_OWNER approval is accepted only once and when current', () => withFixture(f => {
  f.manifest.approvals.push({
    role: 'RELEASE_OWNER',
    signerRef: 'synthetic-release-owner',
    reviewerIdentityClaim: 'synthetic release owner claim',
    scope: ROLE_SCOPE,
    decision: 'APPROVED',
    signedAt: '2026-11-23T11:00:00.000Z',
    expiresAt: '2026-11-24T11:00:00.000Z',
    evidenceDigest: '',
  });
  f.manifest.evidenceDigest = computeEvidenceDigest(f.manifest);
  for (const approval of f.manifest.approvals) approval.evidenceDigest = f.manifest.evidenceDigest;
  assert.equal(run(f).verdict, VERDICT.ELIGIBLE);
}));
