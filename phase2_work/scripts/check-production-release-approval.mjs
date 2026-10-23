import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { collectIndependentReviewFailures } from './codeowners-review-policy.mjs';
import { collectReleaseApprovalFailures } from './release-go-evidence.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
let failures;
try {
  const manifest = JSON.parse(readFileSync(resolve(root, 'RELEASE_MANIFEST.json'), 'utf8'));
  const checklist = readFileSync(resolve(root, 'GO_LIVE_CHECKLIST.md'), 'utf8');
  failures = collectReleaseApprovalFailures({ manifest, checklist, env: process.env });
  failures.push(...collectIndependentReviewFailures(manifest, process.env.GITHUB_SHA));
} catch (error) {
  failures = ['Release evidence could not be loaded: ' + (error instanceof Error ? error.message : String(error))];
}
if (failures.length) {
  console.error('Production release approval check FAILED:');
  for (const reason of failures) console.error('- ' + reason);
  process.exitCode = 1;
} else {
  console.log('Release approval structure PASS; linked evidence must also be independently verified by the protected release workflow.');
}
