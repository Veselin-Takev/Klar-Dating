import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, copyFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
test('blocks added raw SDK source and refuses certification with legacy access', () => {
  const dir = mkdtempSync(join(tmpdir(), 'klar-admin-gate-'));
  try {
    for (const path of ['scripts','src/server','docs/security']) mkdirSync(join(dir,'phase2_work',path),{recursive:true});
    const script = 'phase2_work/scripts/check-admin-sdk-boundaries.mjs';
    copyFileSync(resolve('scripts/check-admin-sdk-boundaries.mjs'),join(dir,script));
    const run = (...args) => spawnSync(args[0],args.slice(1),{cwd:dir,encoding:'utf8'});
    assert.equal(run('git','init').status,0);
    assert.equal(run(process.execPath,script,'--inventory').status,0);
    assert.equal(run(process.execPath,script,'--certify').status,0);
    writeFileSync(join(dir,'phase2_work/src/server/rogue.ts'),"db.collection('users').doc(owner).get();\n");
    assert.equal(run('git','add','phase2_work/src/server/rogue.ts').status,0);
    const drift = run(process.execPath,script);
    assert.notEqual(drift.status,0); assert.match(drift.stderr,/source drift/);
    assert.equal(run(process.execPath,script,'--inventory').status,0);
    assert.equal(run(process.execPath,script).status,0);
    const certify = run(process.execPath,script,'--certify');
    assert.equal(certify.status,1); assert.match(certify.stderr,/unscoped Admin SDK consumers remain/);
  } finally { rmSync(dir,{recursive:true,force:true}); }
});
