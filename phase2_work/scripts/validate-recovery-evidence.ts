import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { validateRecoveryDrillEvidence } from '../src/server/platform/recoveryEvidence';

async function main() {
  const path = process.argv[2];
  if (!path) throw new Error('Usage: npx tsx scripts/validate-recovery-evidence.ts <evidence.json> [exact-build-sha]');
  const raw = await readFile(resolve(path), 'utf8');
  const expectedBuildSha = process.argv[3] ?? process.env.GITHUB_SHA ?? process.env.KLAR_BUILD_SHA;
  if (!expectedBuildSha) throw new Error('Provide the exact build SHA as argv[3], GITHUB_SHA, or KLAR_BUILD_SHA');
  const result = validateRecoveryDrillEvidence(JSON.parse(raw), expectedBuildSha);
  if (!result.passed) {
    for (const error of result.errors) console.error('- ' + error);
    process.exitCode = 1;
    return;
  }
  console.log('Recovery drill evidence is complete and within approved RPO/RTO targets.');
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 2;
});
