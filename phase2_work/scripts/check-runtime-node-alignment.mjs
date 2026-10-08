import fs from 'node:fs';

const failures = [];
const expectedNode = '22.23.3';
const dockerfile = fs.readFileSync('Dockerfile', 'utf8');
const expectedImage = 'node:22.23.3-bookworm-slim@sha256:43ac6c60b8f89723f746e8a92ce91abd5017e627ce1ddfe4238355d3a30b772c';
if (!dockerfile.includes(`FROM ${expectedImage} AS runtime`)) {
  failures.push(`Docker runtime must pin ${expectedImage}.`);
}
const toolchainGate = fs.readFileSync('scripts/check-ci-toolchain-pins.mjs', 'utf8');
if (!toolchainGate.includes(`const expectedNode = '${expectedNode}';`)) failures.push('CI toolchain gate must use the same Node version.');
const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
if (!packageJson.engines?.node?.startsWith('>=22.23.3')) failures.push('package.json Node engine floor unexpectedly changed.');
if (failures.length) {
  console.error('Runtime Node alignment gate FAILED:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
console.log(`Runtime Node alignment gate PASS: Docker runtime and CI use Node ${expectedNode}.`);
