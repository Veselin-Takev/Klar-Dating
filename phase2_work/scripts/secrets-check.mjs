import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { scanContent, scanDirectory } from './check-secrets.mjs';

const fixtures = [
  ['google-api-key', 'AIza' + 'a'.repeat(35)],
  ['private-key', '-----BEGIN ' + 'RSA PRIVATE KEY-----'],
  ['stripe-secret', 'sk_' + 'live_' + 'a'.repeat(24)],
  ['stripe-webhook', 'whsec_' + 'a'.repeat(24)],
  ['sendgrid', 'SG.' + 'a'.repeat(22) + '.' + 'b'.repeat(43)],
  ['github-token', 'ghp_' + 'a'.repeat(36)],
  ['aws-access-key', 'AKIA' + 'A'.repeat(16)],
  ['google-oauth-secret', 'GOCSPX-' + 'a'.repeat(28)],
  ['slack-token', 'xoxb-' + 'a'.repeat(24)],
  ['npm-token', 'npm_' + 'a'.repeat(36)],
];
for (const [rule, token] of fixtures) {
  test('detects and redacts ' + rule, () => {
    const findings = scanContent('first line\n' + token, 'tests/fixture.txt');
    assert.deepEqual(findings, [{ path: 'tests/fixture.txt', rule, line: 2 }]);
    assert.ok(!JSON.stringify(findings).includes(token));
  });
}

test('does not skip tests, scanner-named files or firebase-like filenames', () => {
  for (const name of ['tests/fixture.ts', 'scripts/check-secrets.mjs', 'copy-firebase-applet-config.json']) {
    assert.equal(scanContent(fixtures[2][1], name).length, 1);
  }
});

test('public Firebase exception is restricted to the known value, project, exact file and field', () => {
  const source = fs.readFileSync(new URL('../firebase-applet-config.json', import.meta.url), 'utf8');
  const config = JSON.parse(source);
  assert.equal(scanContent(source, 'firebase-applet-config.json').length, 0);
  assert.ok(scanContent(source, 'other/firebase-applet-config.json').length > 0);
  assert.ok(scanContent(JSON.stringify({ ...config, projectId: 'other' }), 'firebase-applet-config.json').length > 0);
  assert.ok(scanContent(JSON.stringify({ ...config, apiKey: fixtures[0][1] }), 'firebase-applet-config.json').length > 0);
  assert.ok(scanContent(JSON.stringify({ ...config, unexpectedSecret: fixtures[2][1] }), 'firebase-applet-config.json').length > 0);
  assert.ok(scanContent(JSON.stringify({ ...config, extraKey: config.apiKey }), 'firebase-applet-config.json').length > 0);
  assert.throws(() => scanContent('{broken', 'firebase-applet-config.json'));
});

test('CLI scans hidden files and fails without exposing credential content', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'secret-boundary-'));
  try {
    fs.writeFileSync(path.join(root, '.env'), fixtures[2][1]);
    const result = spawnSync(process.execPath, [fileURLToPath(new URL('./check-secrets.mjs', import.meta.url))], { cwd: root, encoding: 'utf8' });
    assert.equal(result.status, 1);
    assert.ok(result.stderr.includes('stripe-secret'));
    assert.ok(!(result.stdout + result.stderr).includes(fixtures[2][1]));
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('missing files, empty scans and unsupported symlinks fail closed', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'secret-incomplete-'));
  try {
    assert.throws(() => scanDirectory(root), /empty-scan/);
    assert.throws(() => scanDirectory(path.join(root, 'missing')));
    fs.symlinkSync(path.join(root, 'missing'), path.join(root, 'link'));
    const result = spawnSync(process.execPath, [fileURLToPath(new URL('./check-secrets.mjs', import.meta.url))], { cwd: root, encoding: 'utf8' });
    assert.equal(result.status, 2);
    assert.ok(result.stderr.includes('INCOMPLETE'));
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('directory exclusions do not exempt similarly named source files', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'secret-scope-'));
  try {
    fs.mkdirSync(path.join(root, 'node_modules'));
    fs.writeFileSync(path.join(root, 'node_modules', 'dependency'), fixtures[2][1]);
    fs.writeFileSync(path.join(root, 'node_modules.txt'), fixtures[2][1]);
    const result = scanDirectory(root);
    assert.equal(result.scanned, 1);
    assert.equal(result.findings.length, 1);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});
