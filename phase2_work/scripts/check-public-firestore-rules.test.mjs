import { strict as assert } from 'node:assert';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

// An offline mutation test of the fast, deliberately NON-compiling scope
// check. No Firebase credentials, emulator, network or production data.
const scriptsDir = path.dirname(fileURLToPath(import.meta.url));
const phaseRoot = path.resolve(scriptsDir, '..');
const repositoryRoot = path.resolve(phaseRoot, '..');
const script = path.join(scriptsDir, 'check-public-firestore-rules.mjs');

function runWithRules(mutate = () => {}) {
  const parent = mkdtempSync(path.join(tmpdir(), 'klar-rule-scope-'));
  const working = path.join(parent, 'phase2_work');
  mkdirSync(working);
  try {
    const files = [
      [path.join(phaseRoot, 'firestore.rules'), path.join(working, 'firestore.rules')],
      [path.join(repositoryRoot, 'firestore.rules'), path.join(parent, 'firestore.rules')],
      [path.join(phaseRoot, 'firebase.json'), path.join(working, 'firebase.json')],
      [path.join(repositoryRoot, 'firebase.json'), path.join(parent, 'firebase.json')],
    ];
    for (const [source, destination] of files) {
      writeFileSync(destination, readFileSync(source, 'utf8'));
    }
    mutate({ phase: files[0][1], root: files[1][1] });
    const result = spawnSync(process.execPath, [script], {
      cwd: working, encoding: 'utf8', timeout: 10000,
      env: { ...process.env, NODE_ENV: 'test' },
    });
    assert.equal(result.error, undefined);
    return result;
  } finally {
    rmSync(parent, { recursive: true, force: true });
  }
}

test('accepts both explicitly scoped production-source rulesets (source-only)', () => {
  const result = runWithRules();
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /scoped userId PASS/);
});

test('rejects missing userId in phase2 rule helper declaration', () => {
  const result = runWithRules(({ phase }) => {
    const original = readFileSync(phase, 'utf8');
    assert.match(original, /function validUserMutableUpdate\(userId\)/);
    writeFileSync(phase, original.replace(
      'function validUserMutableUpdate(userId)',
      'function validUserMutableUpdate()',
    ));
  });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /explicit scoped helper argument/);
});

test('rejects missing userId in root rules call site', () => {
  const result = runWithRules(({ root }) => {
    const original = readFileSync(root, 'utf8');
    assert.match(original, /&& validUserMutableUpdate\(userId\)/);
    writeFileSync(root, original.replace(
      '&& validUserMutableUpdate(userId)',
      '&& validUserMutableUpdate()',
    ));
  });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /explicit scoped helper argument/);
});

test('retains unconditional public-access denial independent of the scope fix', () => {
  const result = runWithRules(({ phase }) => {
    const original = readFileSync(phase, 'utf8');
    writeFileSync(phase, original.replace(
      'match /users/{userId} {',
      'match /accidentally_open/{recordId} { allow read: if true; }\n' +
      '    match /users/{userId} {',
    ));
  });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /unconditional public access/);
});
test('rejects unconditional public read added only to root Firestore rules', () => {
  const result = runWithRules(({ root }) => {
    const original = readFileSync(root, 'utf8');
    assert.match(original, /match \/users\/\{userId\}/);
    writeFileSync(root, original.replace(
      'match /users/{userId} {',
      'match /unreviewed_root/{id} { allow read: if true; }\n' +
      '    match /users/{userId} {',
    ));
  });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /\.\.\/firestore\.rules:/);
  assert.match(result.stderr, /unconditional public access/);
});

test('rejects missing target-adult gate in root public_profiles rule', () => {
  const result = runWithRules(({ root }) => {
    const original = readFileSync(root, 'utf8');
    const expected = 'get(/databases/$(database)/documents/users/$(userId)).data.isAdult == true';
    assert.ok(original.includes(expected));
    writeFileSync(root, original.replace(expected, 'true'));
  });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /public_profiles reads are not bound to the target adult gate/);
});

test('rejects missing target-adult gate in phase2 public_profiles rule', () => {
  const result = runWithRules(({ phase }) => {
    const original = readFileSync(phase, 'utf8');
    const expected = 'get(/databases/$(database)/documents/users/$(userId)).data.isAdult == true';
    assert.ok(original.includes(expected));
    writeFileSync(phase, original.replace(expected, 'false'));
  });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /public_profiles reads are not bound to the target adult gate/);
});
test('rejects changes to the root Firebase deployment rules location', () => {
  const result = runWithRules(({ root }) => {
    const configPath = path.join(path.dirname(root), 'firebase.json');
    const config = JSON.parse(readFileSync(configPath, 'utf8'));
    config.firestore.rules = 'rules/unreviewed.rules';
    writeFileSync(configPath, JSON.stringify(config));
  });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /unreviewed Firebase rules path/);
});
