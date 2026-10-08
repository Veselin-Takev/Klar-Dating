import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, '../..');
const workflowDir = path.join(repoRoot, '.github', 'workflows');
const failures = [];
const expectedNode = '22.23.3';
const workflows = fs.readdirSync(workflowDir)
  .filter(name => /\.ya?ml$/.test(name))
  
  .map(name => path.join(workflowDir, name))
  .sort();
if (workflows.length === 0) {
  console.error('CI toolchain pin gate FAILED: no GitHub Actions workflows found.');
  process.exit(1);
}

for (const file of workflows) {
  if (!fs.existsSync(file)) {
    failures.push(`${file} is missing from the supported workflow surface.`);
    continue;
  }
  const text = fs.readFileSync(file, 'utf8');
  if (!text.includes('actions/setup-node@820762786026740c76f36085b0efc47a31fe5020')) {
    failures.push(`${file} must pin actions/setup-node to the approved immutable revision.`);
  }
  if (!text.includes(`node-version: '${expectedNode}'`)) {
    failures.push(`${file} must pin Node ${expectedNode}.`);
  }
  if (!text.includes("oven-sh/setup-bun@0c5077e51419868618aeaa5fe8019c62421857d6")) {
    failures.push(`${file} must pin Bun 1.4.2.`);
  }
}

const packageJson = JSON.parse(fs.readFileSync(path.join(repoRoot, 'phase2_work', 'package.json'), 'utf8'));
if (packageJson.engines?.node !== '>=22.23.3') {
  failures.push(`package.json engines.node must remain >=${expectedNode}.`);
}

if (failures.length) {
  console.error(`CI toolchain pin gate FAILED (${failures.length}):`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
console.log(`CI toolchain pin gate PASS: supported GitHub workflows pin Node ${expectedNode} and Bun 1.4.2.`);
