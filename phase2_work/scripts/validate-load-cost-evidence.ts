import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { validateProductionLoadCostEvidence } from '../src/server/platform/loadCostEvidence';

async function main() {
  const evidencePath = process.argv[2];
  const loadReportPath = process.argv[3];
  if (!evidencePath || !loadReportPath) {
    throw new Error('Usage: npx tsx scripts/validate-load-cost-evidence.ts <evidence.json> <load-report.json> [exact-build-sha]');
  }
  const [evidenceRaw, loadRaw] = await Promise.all([
    readFile(resolve(evidencePath), 'utf8'),
    readFile(resolve(loadReportPath), 'utf8'),
  ]);
  const expectedBuildSha = process.argv[4] ?? process.env.GITHUB_SHA ?? process.env.KLAR_BUILD_SHA;
  if (!expectedBuildSha) throw new Error('Provide the exact build SHA as argv[4], GITHUB_SHA, or KLAR_BUILD_SHA');
  const result = validateProductionLoadCostEvidence(JSON.parse(evidenceRaw), JSON.parse(loadRaw), expectedBuildSha);
  if (!result.passed) {
    for (const error of result.errors) console.error('- ' + error);
    process.exitCode = 1;
    return;
  }
  console.log('Production load/cost evidence is internally consistent and within the approved budget.');
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 2;
});
