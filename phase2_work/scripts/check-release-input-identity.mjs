import { readFileSync } from 'node:fs';

const workflow = readFileSync('.github/workflows/release.yml', 'utf8');
const required = [
  'node scripts/write-release-input-identity.mjs',
  'release/release-input-identity.json',
  'release/release-input-identity.json >> release/SHA256SUMS',
];
const failures = required.filter(token => !workflow.includes(token)).map(token => `release workflow missing ${token}`);
if (!workflow.includes('release/klar-${GITHUB_REF_NAME}.tar.gz')) failures.push('release workflow must create the git archive used by release-input-identity');
if (failures.length) {
  console.error('Release input identity gate FAILED:');
  for (const failure of failures) console.error('- ' + failure);
  process.exit(1);
}
console.log('Release input identity gate PASS.');
