import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { validateOperationalControlEvidence } from '../src/server/platform/operationalControlEvidence';

async function main() {
  const path = process.argv[2];
  if (!path) throw new Error('Usage: npx tsx scripts/validate-operational-control-evidence.ts <evidence.json> [exact-build-sha]');
  const expectedBuildSha = process.argv[3] ?? process.env.GITHUB_SHA ?? process.env.KLAR_BUILD_SHA;
  if (!expectedBuildSha) throw new Error('Provide the exact build SHA as argv[3], GITHUB_SHA, or KLAR_BUILD_SHA');
  const result = validateOperationalControlEvidence(JSON.parse(await readFile(resolve(path), 'utf8')), expectedBuildSha);
  if (!result.passed) {
    for (const error of result.errors) console.error('- ' + error);
    process.exitCode = 1;
    return;
  }
  console.log('Secret rotation and alert delivery evidence is complete.');
}

main().catch(error => { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 2; });
