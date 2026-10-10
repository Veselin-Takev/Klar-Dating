import { execFileSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { verifyLocalProvenance } from './verify-local-provenance.mjs';
import {
  auditCloudRunService, auditMonitoring, auditProjectRoles, auditSecretPolicies,
} from '../src/server/platform/productionControls';

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(name + ' is required');
  return value;
}

function csv(name: string): string[] {
  const value = required(name);
  const entries = [...new Set(value.split(',').map(item => item.trim()).filter(Boolean))];
  if (!entries.length) throw new Error(name + ' must not be empty');
  return entries;
}

function gcloud(args: string[]): unknown {
  const output = execFileSync('gcloud', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  return JSON.parse(output || 'null');
}

async function main() {
  const project = required('KLAR_PROJECT_ID');
  const region = required('KLAR_REGION');
  const service = required('KLAR_SERVICE');
  const expectedServiceAccount = required('KLAR_EXPECTED_SERVICE_ACCOUNT');
  const requiredSecrets = csv('KLAR_REQUIRED_SECRETS');
  const requiredAlertPolicies = csv('KLAR_REQUIRED_ALERT_POLICIES');
  const expectedBuildSha = required('KLAR_EXPECTED_SHA');
  if (!/^[0-9a-f]{40}$/.test(expectedBuildSha)) throw new Error('KLAR_EXPECTED_SHA must be a full lowercase 40-character commit SHA.');
  const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
  const actualBuildSha = verifyLocalProvenance(repositoryRoot);
  if (actualBuildSha !== expectedBuildSha) throw new Error('Production controls audit checkout does not match KLAR_EXPECTED_SHA.');

  const output = resolve(process.env.KLAR_PRODUCTION_CONTROLS_OUTPUT ?? 'production-evidence/controls.json');

  const serviceJson = gcloud(['run','services','describe',service,'--project',project,'--region',region,'--format=json']);
  const iamJson = gcloud(['projects','get-iam-policy',project,'--format=json']);
  const secretPolicies: Record<string, unknown> = {};
  for (const secret of requiredSecrets) {
    secretPolicies[secret] = gcloud(['secrets','get-iam-policy',secret,'--project',project,'--format=json']);
  }
  const alertPolicies = gcloud(['monitoring','policies','list','--project',project,'--format=json']);
  const channels = gcloud(['monitoring','channels','list','--project',project,'--format=json']);

  const cloudRun = auditCloudRunService({ service: serviceJson, expectedServiceAccount, requiredSecrets });
  const iam = auditProjectRoles(iamJson, expectedServiceAccount);
  const secrets = auditSecretPolicies(secretPolicies, expectedServiceAccount, requiredSecrets);
  const monitoring = auditMonitoring(alertPolicies, channels, requiredAlertPolicies);
  const errors = [...cloudRun.errors, ...iam.errors, ...secrets.errors, ...monitoring.errors];
  const report = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    buildSha: actualBuildSha,
    project, region, service, expectedServiceAccount, requiredSecrets, requiredAlertPolicies,
    cloudRun, iam, secrets, monitoring,
    passed: errors.length === 0,
    errors,
    limitations: [
      'Read-only configuration audit; it does not prove alert delivery to a human.',
      'Secret accessor presence does not prove that rotation has been exercised.',
      'IAM review must still confirm each non-primitive role is required by the workload.',
    ],
  };
  await mkdir(dirname(output), { recursive: true });
  await writeFile(output, JSON.stringify(report, null, 2) + '\n', { encoding: 'utf8', mode: 0o600, flag: 'wx' });
  console.log(JSON.stringify(report, null, 2));
  if (!report.passed) process.exitCode = 1;
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 2;
});
