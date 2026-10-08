import fs from 'node:fs';

const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const script = pkg.scripts?.['check:enterprise'] ?? '';
const failures = [];

if (!script) failures.push('package.json must define check:enterprise');

for (const token of script.split(/\s*&&\s*/).map(part => part.trim()).filter(Boolean)) {
  const match = token.match(/(?:bun|npm)\s+run\s+(check:[A-Za-z0-9_-]+)$/);
  const rawCheck = token.match(/^(check:[A-Za-z0-9_-]+)$/)?.[1];
  const name = match?.[1] ?? rawCheck;
  if (!name) continue;
  if (rawCheck) failures.push(`${rawCheck} must be invoked through the package runner, not as a bare shell command.`);
  if (!pkg.scripts?.[name]) failures.push(`${name} is referenced by check:enterprise but is not defined in package.json.`);
}

if (failures.length) {
  console.error('Enterprise script composition gate FAILED:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
console.log('Enterprise script composition gate PASS.');
