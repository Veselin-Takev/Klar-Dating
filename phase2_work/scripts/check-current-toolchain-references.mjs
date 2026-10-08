import fs from 'node:fs';

const failures = [];
const currentFiles = [
  'README.md',
  'PRODUCTION_READINESS.md',
  'RELEASE_MANIFEST.json',
  'RELEASE_CANDIDATE.md',
];
const stalePatterns = [
  /Node(?:\.js)?\s+22\.23\.0/g,
  /Node(?:\.js)?\s+22\.22\.3/g,
  /node:22\.23\.0-bookworm-slim/g,
  /node:22\.22\.3-bookworm-slim/g,
];
for (const file of currentFiles) {
  let text = fs.readFileSync(file, 'utf8');
  if (file === 'RELEASE_CANDIDATE.md') text = text.split('## Klar Release Candidate — v53')[0];
  for (const pattern of stalePatterns) {
    if (pattern.test(text)) failures.push(`${file} contains stale current toolchain reference: ${pattern}`);
    pattern.lastIndex = 0;
  }
}
const manifest = JSON.parse(fs.readFileSync('RELEASE_MANIFEST.json', 'utf8'));
if (manifest.node !== '22.23.3') failures.push('RELEASE_MANIFEST.json must declare Node 22.23.3.');
if (failures.length) {
  console.error(`Current toolchain reference gate FAILED (${failures.length}):`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
console.log('Current toolchain reference gate PASS.');
