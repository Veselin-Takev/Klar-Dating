import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { isApprovedEvidenceHostname, validateOperationalControlEvidence } from '../src/server/platform/operationalControlEvidence';

async function main() {
  const path = process.argv[2];
  const expectedBuildSha = process.argv[3];
  const environment = process.env.KLAR_EVIDENCE_ENVIRONMENT;
  const hosts = process.env.KLAR_APPROVED_EVIDENCE_HOSTS;
  const notBefore = process.env.KLAR_EVIDENCE_NOT_BEFORE;
  if (!path || !expectedBuildSha) {
    throw new Error('Usage: KLAR_EVIDENCE_ENVIRONMENT=production KLAR_APPROVED_EVIDENCE_HOSTS=approved.example KLAR_EVIDENCE_NOT_BEFORE=2026-10-10T00:00:00Z npx tsx scripts/validate-operational-control-evidence.ts <evidence.json> <exact-build-sha>');
  }
  if (!/^[0-9a-f]{40}$/.test(expectedBuildSha)) throw new Error('A full lowercase 40-character exact build SHA is required.');
  if (environment !== 'production' && environment !== 'staging') throw new Error('KLAR_EVIDENCE_ENVIRONMENT must be production or staging.');
  if (!hosts?.trim() || !notBefore?.trim()) throw new Error('Explicit KLAR_APPROVED_EVIDENCE_HOSTS and KLAR_EVIDENCE_NOT_BEFORE are required.');
  const approvedHosts = hosts.split(',').map(x => x.trim()).filter(Boolean);
  if (approvedHosts.some(host => !isApprovedEvidenceHostname(host))) throw new Error('Approved evidence hosts must be valid plain DNS hostnames.');
  const result = validateOperationalControlEvidence(
    JSON.parse(await readFile(resolve(path), 'utf8')),
    expectedBuildSha,
    environment,
    approvedHosts,
    notBefore,
  );
  if (!result.passed) {
    for (const error of result.errors) console.error('- ' + error);
    process.exitCode = 1;
    return;
  }
  console.log('Operational evidence schema checks PASS; live evidence and human approval remain required.');
}

main().catch(error => { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 2; });
