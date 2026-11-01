import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {buildRulesEvidence, validateRulesConfig} from './check-tenant-rules-surfaces.mjs';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const read=path=>readFileSync(resolve(root,path),'utf8');
const production=JSON.parse(read('firebase.json'));
const emulator=JSON.parse(read('firebase.pruefung.json'));
const sources={'firestore.rules':read('firestore.rules'),'storage.rules':read('storage.rules')};
const execute=()=>spawnSync(process.execPath,['scripts/check-tenant-rules-surfaces.mjs'],{
  cwd:root,encoding:'utf8',timeout:30000,maxBuffer:1_000_000,
});
test('exact deployed-default source configs and rules SHA agree; never claim live tenant isolation',()=>{
  const result=execute();
  assert.equal(result.status,0,result.stderr);
  assert.equal(result.stdout,execute().stdout,'nondeterministic rule surface inventory');
  const output=JSON.parse(result.stdout);
  assert.equal(output.schemaVersion,1);
  assert.equal(output.readOnly,true);
  assert.equal(output.isolationAndDeploymentApproval,'BLOCKED_INDEPENDENT_REVIEW');
  assert.deepEqual(output.configPaths,{firestore:'firestore.rules',storage:'storage.rules'});
  assert.deepEqual(output.surfaces.map(x=>x.path),['firestore.rules','storage.rules']);
  for(const item of output.surfaces){
    assert.equal(item.sha256,createHash('sha256').update(sources[item.path]).digest('hex'));
    assert.equal(item.bytes,Buffer.byteLength(sources[item.path]));
    assert.equal(item.tenantIsolationCertified,false);
    assert.equal(item.deployedRulesVerified,false);
    assert.ok(item.findings.every(x=>x.lines.every(n=>Number.isInteger(n)&&n>0)));
    assert.deepEqual(Object.keys(item).sort(),
      ['bytes','deployedRulesVerified','findings','path','sha256','tenantIsolationCertified']);
  }
  // These flat namespaces are evidence of migration work still required.
  assert.ok(output.surfaces.find(x=>x.path==='firestore.rules').findings
    .some(x=>x.kind==='legacy_users' && x.lines.length));
  assert.ok(output.surfaces.find(x=>x.path==='storage.rules').findings
    .some(x=>x.kind==='biometric_verification' && x.lines.length));
  assert.ok(!result.stdout.includes('allow read:'));
});
test('deny storage-rule omission, redirected files, and diverging emulator rules',()=>{
  for(const broken of [
    {...production,storage:undefined},
    {...production,storage:{rules:'../other.rules'}},
    {...production,firestore:{rules:'firestore.insecure.rules'}},
  ])assert.throws(()=>validateRulesConfig(broken,emulator),/rules_config_missing/);
  assert.throws(()=>validateRulesConfig(production,{firestore:{rules:'other.rules'}}),
    /emulator_rule_path_divergence/);
});
test('deny absent, invalid and corrupted rule source rather than silently certifying a tenant',()=>{
  assert.throws(()=>buildRulesEvidence(production,emulator,{}),/rules_source_invalid/);
  assert.throws(()=>buildRulesEvidence(production,emulator,
    {...sources,'storage.rules':'allow read, write: if true;'}),/rules_source_invalid/);
});
