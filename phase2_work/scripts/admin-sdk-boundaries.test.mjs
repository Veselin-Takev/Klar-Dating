import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  copyFileSync,
  rmSync,
  symlinkSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
test('blocks added raw SDK source and refuses certification with legacy access', () => {
  const dir = mkdtempSync(join(tmpdir(), 'klar-admin-gate-'));
  try {
    for (const path of ['scripts', 'src/server', 'docs/security'])
      mkdirSync(join(dir, 'phase2_work', path), { recursive: true });
    const script = 'phase2_work/scripts/check-admin-sdk-boundaries.mjs';
    copyFileSync(
      resolve('scripts/check-admin-sdk-boundaries.mjs'),
      join(dir, script),
    );
    symlinkSync(
      resolve('node_modules'),
      join(dir, 'phase2_work/node_modules'),
      'dir',
    );
    const run = (...args) =>
      spawnSync(args[0], args.slice(1), { cwd: dir, encoding: 'utf8' });
    assert.equal(run('git', 'init').status, 0);
    assert.equal(run(process.execPath, script, '--inventory').status, 0);
    assert.equal(run(process.execPath, script, '--certify').status, 0);
    writeFileSync(
      join(dir, 'phase2_work/src/server/rogue.ts'),
      "db.collection('users').doc(owner).get();\n",
    );

    const drift = run(process.execPath, script);
    assert.notEqual(drift.status, 0);
    assert.match(drift.stderr, /source drift/);
    assert.equal(run(process.execPath, script, '--inventory').status, 0);
    assert.equal(run(process.execPath, script).status, 0);
    const certify = run(process.execPath, script, '--certify');
    assert.equal(certify.status, 1);
    assert.match(certify.stderr, /unscoped Admin SDK consumers remain/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

for (const [name, source] of Object.entries({
  rootAlias: "import {firestore as open} from 'firebase-admin'; open();",
  barrel: "export * from '../db';",
  importEquals: "import admin = require('firebase-admin'); const open=admin.firestore; open();",
  alias:
    "import {getFirestore as open} from 'firebase-admin/firestore'; const db=open();",
  rawFixture: "import {getDb as open} from './db'; const db=open();",
  namespace:
    "import * as db from './firestoreRepository/nativeDatabase'; db.getEmulatorDatabase();",
  computed: "const db = connection; db['collection']('users');",
  dynamic: "const db = await import('./db');",
  nestedFolder:
    "import {getFirestore} from 'firebase-admin/firestore'; getFirestore();",
}))
  test('blocks ' + name + ' bypass, including untracked source', () => {
    const dir = mkdtempSync(join(tmpdir(), 'klar-admin-bypass-'));
    try {
      mkdirSync(join(dir, 'phase2_work/scripts'), { recursive: true });
      mkdirSync(join(dir, 'phase2_work/docs/security'), { recursive: true });
      mkdirSync(join(dir, 'phase2_work/src/server/firestoreRepository'), {
        recursive: true,
      });
      symlinkSync(
        resolve('node_modules'),
        join(dir, 'phase2_work/node_modules'),
        'dir',
      );
      copyFileSync(
        resolve('scripts/check-admin-sdk-boundaries.mjs'),
        join(dir, 'phase2_work/scripts/check-admin-sdk-boundaries.mjs'),
      );
      const run = (...args) =>
        spawnSync(args[0], args.slice(1), { cwd: dir, encoding: 'utf8' });
      run('git', 'init');
      const script = 'phase2_work/scripts/check-admin-sdk-boundaries.mjs';
      assert.equal(run(process.execPath, script, '--inventory').status, 0);
      writeFileSync(
        join(dir, 'phase2_work/src/server/firestoreRepository/rogue.ts'),
        source,
      );
      assert.notEqual(run(process.execPath, script, '--certify').status, 0);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
