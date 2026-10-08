import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, '../..');
const activeDir = path.join(repoRoot, '.github', 'workflows');
const legacyDir = path.join(repoRoot, 'phase2_work', '.github', 'workflows');

if (!fs.existsSync(activeDir)) {
  throw new Error('Workflow layout gate FAILED: repository-root .github/workflows is missing.');
}

if (fs.existsSync(legacyDir)) {
  const legacyFiles = fs.readdirSync(legacyDir).filter((name) => /\.ya?ml$/i.test(name));
  if (legacyFiles.length > 0) {
    throw new Error(`Workflow layout gate FAILED: inactive nested workflow shadow exists under phase2_work/.github/workflows: ${legacyFiles.join(', ')}`);
  }
}

console.log('Workflow layout gate PASS: repository-root .github/workflows is the single workflow source of truth.');
