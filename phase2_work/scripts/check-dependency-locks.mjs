import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, '../..');

const failures = [];

if (!fs.existsSync(path.join(repoRoot, 'phase2_work', 'bun.lock'))) failures.push('Root dependency lock bun.lock is missing.');
if (fs.existsSync(path.join(repoRoot, 'phase2_work', 'package-lock.json'))) failures.push('package-lock.json must not coexist with the Bun-only root dependency policy.');
const optionalRootWorkflows = ['auto-version.yml'];
for (const name of optionalRootWorkflows) {
  const workflowPath = path.join(repoRoot, '.github', 'workflows', name);
  if (!fs.existsSync(workflowPath)) continue;
  const workflowText = fs.readFileSync(workflowPath, 'utf8');
  if (workflowText.includes('package-lock.json')) failures.push(`${name} must not reference root package-lock.json under the Bun-only root dependency policy.`);
  if (!workflowText.includes("bun-version: '1.4.2'")) failures.push(`${name} must pin Bun 1.4.2 for the root package graph.`);
}
if (!fs.existsSync(path.join(repoRoot, 'phase2_work/functions/package-lock.json'))) {
  failures.push('functions/: package-lock.json is missing. Functions use npm@10.9.2 and require a committed npm lockfile for reproducible CI/CD installs.');
}
if (fs.existsSync(path.join(repoRoot, 'phase2_work/functions/bun.lock'))) failures.push('functions/bun.lock must not coexist with the npm-only Functions dependency policy.')

const workflowPolicies = [
  ['.github/workflows/ci.yml', 'npm ci --prefix functions --ignore-scripts --no-audit --no-fund'],
  ['.github/workflows/release.yml', 'npm ci --prefix functions --ignore-scripts --no-audit --no-fund'],
  ['.gitlab-ci.yml', 'npm ci --prefix functions --ignore-scripts --no-audit --no-fund'],
];
for (const [workflow, installCommand] of workflowPolicies) {
  const workflowPath = path.join(repoRoot, workflow);
  if (!fs.existsSync(workflowPath)) {
    failures.push(`${workflow} is missing from the supported CI/release surface.`);
    continue;
  }
  const workflowText = fs.readFileSync(workflowPath, 'utf8');
  const gateIndex = workflowText.indexOf('check-dependency-locks.mjs');
  const installIndex = workflowText.indexOf(installCommand);
  if (gateIndex === -1) failures.push(`${workflow} must execute check-dependency-locks.mjs.`);
  if (installIndex !== -1 && (gateIndex === -1 || gateIndex > installIndex)) {
    failures.push(`${workflow} must run the dependency-lock gate before installing the Functions dependency graph.`);
  }
}

if (failures.length) {
  console.error('Dependency lock gate FAILED:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('Dependency lock gate PASS: root and Functions dependency graphs are explicitly locked.');
