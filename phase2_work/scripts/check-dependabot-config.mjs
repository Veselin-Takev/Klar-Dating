import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, '../..');
const configPath = path.join(repoRoot, '.github', 'dependabot.yml');
const failures = [];

if (!fs.existsSync(configPath)) {
  failures.push('.github/dependabot.yml is required for continuous dependency-update coverage.');
} else {
  const text = fs.readFileSync(configPath, 'utf8');
  if (!/^version:\s*2\s*$/m.test(text)) failures.push('Dependabot config must use version 2.');
  const required = [
    ['github-actions', '/'],
    ['bun', '/phase2_work'],
    ['npm', '/phase2_work/functions'],
    ['docker', '/phase2_work'],
  ];
  for (const [ecosystem, directory] of required) {
    const block = text.match(new RegExp(`package-ecosystem:\\s*${ecosystem}[\\s\\S]*?(?=\\n\\s*- package-ecosystem:|\\s*$)`))?.[0] ?? '';
    if (!block) {
      failures.push(`Dependabot ecosystem ${ecosystem} is missing.`);
      continue;
    }
    if (!block.includes(`directory: ${directory}`)) failures.push(`Dependabot ${ecosystem} directory must be ${directory}.`);
    if (!/schedule:[\\s\\S]*?interval:\\s*weekly/.test(block)) failures.push(`Dependabot ${ecosystem} must run on a weekly schedule.`);
  }
}

if (failures.length) {
  console.error('Dependabot configuration gate FAILED:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
console.log('Dependabot configuration gate PASS: Actions, Bun, Functions npm, and Docker coverage are configured.');
