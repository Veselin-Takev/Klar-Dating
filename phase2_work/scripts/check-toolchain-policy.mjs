import fs from 'node:fs';
import process from 'node:process';

const failures = [];
const rootPackage = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const functionsPackage = JSON.parse(fs.readFileSync('functions/package.json', 'utf8'));

if (rootPackage.packageManager !== 'bun@1.4.2') {
  failures.push(`Root packageManager must be bun@1.4.2 (found ${rootPackage.packageManager ?? 'missing'}).`);
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

if (failures.length) {
  console.error(`Toolchain policy FAILED (${failures.length}):`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
console.log('Toolchain policy PASS: Bun root, npm Functions boundary and ESLint 9 Flat Config are consistent.');
