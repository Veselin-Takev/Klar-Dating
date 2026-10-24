#!/usr/bin/env node
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
const sourceRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const root = mkdtempSync(join(tmpdir(), 'klar-retention-boundary-'));
const files = ['scripts/check-retention-matrix.mjs', 'scripts/configure-retention.sh', 'docs/DATA_RETENTION.md', 'docs/PRODUCTION_RUNBOOK.md'];
try {
  for (const name of files) {
    const to = join(root,name);mkdirSync(dirname(to),{recursive:true});writeFileSync(to,readFileSync(join(sourceRoot,name)));
  }
  writeFileSync(join(root,'package.json'), '{"type":"module"}\n');
  const docFile=join(root,'docs/DATA_RETENTION.md');
  const pristine=readFileSync(docFile,'utf8');
  function run(doc){writeFileSync(docFile,doc);return spawnSync(process.execPath,[join(root,'scripts/check-retention-matrix.mjs')],{encoding:'utf8'});}
  let r=run(pristine);assert.equal(r.status,0,r.stderr);console.log('PASS pristine document');
  for (const suffix of ['_fake','_old','2']) {
    const altered=pristine.replace('--collection-group=messages',`--collection-group=messages${suffix}`);
    assert.notEqual(altered,pristine);
    r=run(altered);assert.notEqual(r.status,0,'Suffix collision accepted: '+suffix);console.log('PASS reject suffix '+suffix);
  }
  r=run(pristine.replace('--collection-group=messages','--collection-group=messages-backup'));
  assert.notEqual(r.status,0);console.log('PASS reject hyphen suffix');
} finally {rmSync(root,{recursive:true,force:true});}
