import { fileURLToPath } from 'node:url';
import { dockerToolchainFailures } from './docker-toolchain.mjs';
import fs from 'node:fs';
import process from 'node:process';

const failures = [];
const rootPackage = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const functionsPackage = JSON.parse(fs.readFileSync('functions/package.json', 'utf8'));

if (rootPackage.packageManager !== 'bun@1.4.4') {
  failures.push(`Root packageManager must be bun@1.4.4 (found ${rootPackage.packageManager ?? 'missing'}).`);
}
if (!fs.existsSync('bun.lock')) failures.push('Root bun.lock is missing.');
if (fs.existsSync('package-lock.json')) failures.push('Root package-lock.json must not exist under the Bun-only root policy.');
if (fs.existsSync('.eslintrc.json') || fs.existsSync('.eslintrc.js') || fs.existsSync('.eslintrc.cjs')) {
  failures.push('Legacy ESLint config detected. ESLint 9 requires the repository Flat Config eslint.config.mjs.');
}
if (functionsPackage.packageManager !== 'npm@10.9.2') {
  failures.push(`Functions packageManager must be npm@10.9.2 (found ${functionsPackage.packageManager ?? 'missing'}).`);
}
if (!fs.existsSync('eslint.config.mjs')) failures.push('eslint.config.mjs is missing.');

for (const relative of ['../../Dockerfile', '../Dockerfile']) {
  const dockerfile = fileURLToPath(new URL(relative, import.meta.url));
  if (!fs.existsSync(dockerfile)) failures.push(`Missing Dockerfile: ${relative}`);
  else for (const failure of dockerToolchainFailures(fs.readFileSync(dockerfile, 'utf8'))) failures.push(`${relative}: ${failure}`);
}

if (failures.length) {
  console.error(`Toolchain policy FAILED (${failures.length}):`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
console.log('Toolchain policy PASS: Bun root, npm Functions boundary and ESLint 9 Flat Config are consistent.');
