import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// Called only on a private staging directory by collect-live-iam-evidence.sh.
const staging = process.argv[2];
if (!staging || !/\/\.iam-pending\.[A-Za-z0-9]+$/.test(staging)) throw new Error('invalid_iam_staging_directory');
const read = name => readFileSync(resolve(staging, name), 'utf8');
const sha = value => createHash('sha256').update(value).digest('hex');
const summaryText = read('live-iam-evidence.json'), privateText = read('iam-private.json');
const summary = JSON.parse(summaryText), capture = JSON.parse(privateText);
const toolchainText = read('toolchain.json');
if (!JSON.parse(toolchainText)['Google Cloud SDK']) throw new Error('gcloud_version_evidence_missing');
const scope = {project: process.env.GCP_PROJECT_ID, region: process.env.GCP_REGION,
  service: process.env.CLOUD_RUN_SERVICE, bucket: process.env.STORAGE_BUCKET_NAME};
const buildSha = process.env.GCP_EXPECTED_BUILD_SHA;
const collector = readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), 'export-live-iam-evidence.ts'), 'utf8');
if (summary.status !== 'LIVE_CAPTURED_REVIEW_PENDING' || summary.runtimeIdentityMatches !== true
  || summary.reviewStatus !== 'HUMAN_LEAST_PRIVILEGE_REVIEW_REQUIRED'
  || summary.buildSha !== buildSha || capture.buildSha !== buildSha
  || summary.expectedAccount !== `klar-runtime@${scope.project}.iam.gserviceaccount.com`
  || summary.privateExportSha256 !== sha(privateText) || summary.collectorSha256 !== sha(collector)
  || !Number.isFinite(Date.parse(summary.generatedAt)) || summary.generatedAt !== capture.generatedAt
  || Object.entries(scope).some(([key, value]) => summary.scope?.[key] !== value || capture.summary?.scope?.[key] !== value))
  throw new Error('iam_evidence_integrity_failed');
const manifest = {
  schemaVersion: 1, generatedAt: summary.generatedAt, buildSha, scope,
  collectorServiceAccount: process.env.GCP_COLLECTOR_SERVICE_ACCOUNT,
  infrastructureVerification: 'LIVE_CAPTURED_HUMAN_REVIEW_REQUIRED',
  artifacts: {
    privateCapture: {path: 'iam-private.json', sha256: sha(privateText)},
    minimizedSummary: {path: 'live-iam-evidence.json', sha256: sha(summaryText)},
    toolchain: {path: 'toolchain.json', sha256: sha(toolchainText)},
  },
  nextAction: 'INDEPENDENT_INFRASTRUCTURE_REVIEW_THEN_EXISTING_RELEASE_GATES_AND_DUAL_SIGN_OFF',
  technicalSignOff: 'PENDING', legalSignOff: 'PENDING', prDraft: true, productionApproved: false,
};
writeFileSync(resolve(staging, 'HANDOVER_MANIFEST.json'), JSON.stringify(manifest, null, 2) + '\n', {mode: 0o600, flag: 'wx'});
