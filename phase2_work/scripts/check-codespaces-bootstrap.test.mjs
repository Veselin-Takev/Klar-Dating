import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cpSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const scriptRel = 'phase2_work/scripts/check-codespaces-bootstrap.mjs';
const setupRel = 'phase2_work/scripts/setup-codespace.sh';
const configRel = '.devcontainer/devcontainer.json';

function fixture() {
  const dir = mkdtempSync(join(tmpdir(), 'klar-bootstrap-regression-'));
  mkdirSync(join(dir, 'phase2_work/scripts'), { recursive: true });
  mkdirSync(join(dir, '.devcontainer'), { recursive: true });
  for (const path of [scriptRel, setupRel, configRel]) {
    cpSync(join(root, path), join(dir, path));
  }
  return dir;
}
function run(dir) {
  return spawnSync(process.execPath, [join(dir, scriptRel)], { encoding: 'utf8' });
}
test('Codespaces guard accepts pinned committed inputs', () => {
  const dir = fixture();
  try {
    const result = run(dir);
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /invariants PASS/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
test('Codespaces guard rejects invalid Bash even when pin strings remain present', () => {
  const dir = fixture();
  try {
    const file = join(dir, setupRel);
    writeFileSync(file, readFileSync(file, 'utf8') + '\nif then\n');
    const result = run(dir);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /Bash syntax failed/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
test('Codespaces guard rejects a missing exact Bun pin', () => {
  const dir = fixture();
  try {
    const file = join(dir, setupRel);
    const before = readFileSync(file, 'utf8');
    assert.match(before, /bun@1\.4\.2/);
    writeFileSync(file, before.replace('bun@1.4.2', 'bun@latest'));
    const result = run(dir);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /Bun 1\.4\.2 installation/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('Codespaces guard ignores an old Bun pin kept only in a comment', () => {
  const dir = fixture();
  try {
    const file = join(dir, setupRel);
    const before = readFileSync(file, 'utf8');
    assert.match(before, /bun@1\.4\.2/);
    writeFileSync(file, before.replace('bun@1.4.2', 'bun@latest') + '\n# historic command: npm install --global bun@1.4.2\n');
    const result = run(dir);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /Bun 1\.4\.2 installation/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
