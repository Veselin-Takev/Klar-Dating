import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { validateAccessibilityManualEvidence } from '../src/server/platform/accessibilityEvidence';

async function main() {
  const path = process.argv[2] ?? process.env.KLAR_ACCESSIBILITY_EVIDENCE;
  if (!path) throw new Error('Provide an evidence JSON path as argv[2] or KLAR_ACCESSIBILITY_EVIDENCE');
  const raw = await readFile(resolve(path), 'utf8');
  const evidence: unknown = JSON.parse(raw);
  const expectedBuildSha = process.argv[3] ?? process.env.GITHUB_SHA ?? process.env.KLAR_BUILD_SHA;
  if (!expectedBuildSha) throw new Error('Provide the exact build SHA as argv[3], GITHUB_SHA, or KLAR_BUILD_SHA');
  const result = validateAccessibilityManualEvidence(evidence, expectedBuildSha);
  if (!result.passed) {
    for (const error of result.errors) console.error('- ' + error);
    process.exitCode = 1;
    return;
  }
  console.log('Manual accessibility evidence is complete for the declared scope and build.');
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 2;
});
