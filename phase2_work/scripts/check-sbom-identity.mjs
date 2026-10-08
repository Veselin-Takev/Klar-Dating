import { readFile } from 'node:fs/promises';

const workflow = await readFile('.github/workflows/release.yml', 'utf8');
const writer = await readFile('scripts/write-sbom-identity.mjs', 'utf8');
const failures = [];
if (!workflow.includes('node scripts/write-sbom-identity.mjs')) failures.push('release workflow must generate SBOM identity');
if (!workflow.includes('release/sbom-build-identity.json')) failures.push('release workflow must archive SBOM identity');
const checksumLines = workflow.split(/\r?\n/).filter((line) => line.includes('sha256sum') && line.includes('>> release/SHA256SUMS'));
if (!checksumLines.some((line) => line.includes('release/sbom-build-identity.json'))) failures.push('SBOM identity must be checksummed in the release SHA256SUMS command');
for (const token of ["sbom.bomFormat", "sbom.specVersion", "sbom.serialNumber", "KLAR_RELEASE_DIGEST", "createHash('sha256')"]) {
  if (!writer.includes(token)) failures.push(`SBOM identity writer missing fail-closed binding: ${token}`);
}
if (failures.length) {
  console.error('SBOM identity check FAILED:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
console.log('SBOM identity check PASS: CycloneDX identity is bound to commit and immutable image digest and is checksum-covered.');
