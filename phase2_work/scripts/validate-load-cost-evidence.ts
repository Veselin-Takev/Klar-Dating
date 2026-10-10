import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { validateProductionLoadCostEvidence } from '../src/server/platform/loadCostEvidence';

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(name + ' is required');
  return value;
}

function trustedPolicy() {
  const environment = required('KLAR_EVIDENCE_ENVIRONMENT');
  if (environment !== 'production' && environment !== 'staging') {
    throw new Error('KLAR_EVIDENCE_ENVIRONMENT must be production or staging');
  }
  const hosts = required('KLAR_APPROVED_EVIDENCE_HOSTS').split(',').map(host => host.trim().toLowerCase()).filter(Boolean);
  if (hosts.length === 0 || hosts.some(host => !/^[a-z0-9.-]+$/.test(host) || host.startsWith('.') || host.endsWith('.'))) {
    throw new Error('KLAR_APPROVED_EVIDENCE_HOSTS must contain plain DNS hostnames');
  }
  const notBefore = required('KLAR_EVIDENCE_NOT_BEFORE');
  const notAfter = required('KLAR_EVIDENCE_NOT_AFTER');
  if (!Number.isFinite(Date.parse(notBefore)) || !Number.isFinite(Date.parse(notAfter)) || Date.parse(notBefore) > Date.parse(notAfter)) {
    throw new Error('Evidence time window must be valid and ordered');
  }
  const budget = Number(required('KLAR_APPROVED_MAX_COST_PER_1000_REQUESTS_USD'));
  if (!Number.isFinite(budget) || budget <= 0) {
    throw new Error('KLAR_APPROVED_MAX_COST_PER_1000_REQUESTS_USD must be a positive finite number');
  }
  return { environment, hosts, notBefore, notAfter, budget };
}

async function main() {
  const evidencePath = process.argv[2];
  const loadReportPath = process.argv[3];
  const expectedBuildSha = process.argv[4] ?? process.env.KLAR_EXPECTED_SHA;
  if (!evidencePath || !loadReportPath || !expectedBuildSha) {
    throw new Error('Usage: npx tsx scripts/validate-load-cost-evidence.ts <evidence.json> <load-report.json> <exact-build-sha> (with trusted KLAR_EVIDENCE_* and budget env)');
  }
  if (!/^[0-9a-f]{40}$/.test(expectedBuildSha)) {
    throw new Error('Exact lowercase 40-character build SHA is required');
  }
  // Trusted acceptance criteria come only from operator-provided environment,
  // never from the untrusted evidence document being validated.
  const policy = trustedPolicy();
  const [evidenceRaw, loadRaw] = await Promise.all([
    readFile(resolve(evidencePath), 'utf8'),
    readFile(resolve(loadReportPath), 'utf8'),
  ]);
  const evidence = JSON.parse(evidenceRaw) as unknown;
  if (!evidence || typeof evidence !== 'object' || Array.isArray(evidence) ||
      typeof (evidence as { loadReportPath?: unknown }).loadReportPath !== 'string' ||
      resolve((evidence as { loadReportPath: string }).loadReportPath) !== resolve(loadReportPath)) {
    throw new Error('Evidence loadReportPath must refer to the exact supplied load report');
  }
  const result = validateProductionLoadCostEvidence(
    evidence,
    JSON.parse(loadRaw),
    expectedBuildSha,
    policy.environment,
    policy.hosts,
    policy.notBefore,
    policy.notAfter,
    policy.budget,
  );
  if (!result.passed) {
    for (const error of result.errors) console.error('- ' + error);
    process.exitCode = 1;
    return;
  }
  console.log('Production load/cost evidence is internally consistent and within the independently approved budget.');
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 2;
});
