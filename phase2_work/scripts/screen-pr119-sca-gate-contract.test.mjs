import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { screenSCAGateContract, ORIGINAL_GATES, ORIGINAL_GATE_07, TARGET_SHA } from './screen-pr119-sca-gate-contract.mjs';

const SCRIPT = fileURLToPath(new URL('./screen-pr119-sca-gate-contract.mjs', import.meta.url));
function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'klar-sca-contract-'));
  const put = (path, content) => { mkdirSync(dirname(join(root, path)), { recursive: true }); writeFileSync(join(root, path), content); };
  put('phase2_work/package.json', JSON.stringify({ packageManager:'bun@1.4.2', engines:{node:'>=22.23.3'}, scripts:{'check:enterprise':'x',typecheck:'x','test:pure':'x','test:rules':'x',build:'x'} }));
  put('phase2_work/functions/package.json', JSON.stringify({ name:'functions' }));
  put('phase2_work/bun.lock', 'sample bun lock\n');
  put('phase2_work/functions/package-lock.json', '{"lockfileVersion":3}\n');
  put('phase2_work/scripts/check-dependency-locks.mjs', '// package-lock.json must not coexist with the Bun-only root dependency policy.\n');
  return { root, put, cleanup:()=>rmSync(root,{recursive:true,force:true}) };
}
function withFixture(fn) { const f=fixture();try{return fn(f);}finally{f.cleanup();} }

test('exact original gate count and unchanged Gate 07',()=>{assert.equal(ORIGINAL_GATES.length,15);assert.equal(ORIGINAL_GATES[6],ORIGINAL_GATE_07);});
test('baseline Bun/npm conflict is reported fail-closed, not a vulnerability finding',()=>withFixture(({root})=>{
 const r=screenSCAGateContract(root);
 assert.equal(r.release_decision,'NO-GO');assert.equal(r.audit_contract_status,'BLOCKED');assert.equal(r.scanner_executions,0);
 assert.ok(r.findings.some(x=>x.startsWith('GATE_07_CONFLICT:')));
 assert.equal(r.mandatory_host_gates_pass_evidenced,0);assert.equal(r.independent_approvals_evidenced,0);
}));
test('CLI produces JSON and nonzero exit on conflict without network',()=>withFixture(({root})=>{
 const x=spawnSync(process.execPath,[SCRIPT,root],{encoding:'utf8',timeout:10000,env:{PATH:'/nonexistent'}});
 assert.equal(x.status,1);const r=JSON.parse(x.stdout);assert.equal(r.target_commit,TARGET_SHA);assert.equal(r.release_decision,'NO-GO');
}));
test('missing Functions npm lock is detected',()=>withFixture(({root})=>{
 rmSync(join(root,'phase2_work/functions/package-lock.json'));
 assert.ok(screenSCAGateContract(root).findings.some(x=>x.includes('Functions npm lock')));
}));
test('adding app package-lock without approval is rejected',()=>withFixture(({root,put})=>{
 put('phase2_work/package-lock.json','{"lockfileVersion":3}');
 const r=screenSCAGateContract(root);assert.ok(r.findings.some(x=>x.includes('unexpected application npm lock')));
 assert.equal(r.release_decision,'NO-GO');
}));
test('no missing root package.json is tolerated',()=>withFixture(({root})=>{
 rmSync(join(root,'phase2_work/package.json'));
 assert.ok(screenSCAGateContract(root).findings.some(x=>x.includes('application package.json: unavailable')));
}));
test('malformed application manifest is rejected',()=>withFixture(({root,put})=>{
 put('phase2_work/package.json','{bad json');
 assert.ok(screenSCAGateContract(root).findings.includes('application package.json: invalid JSON'));
}));
test('package manager drift is rejected',()=>withFixture(({root,put})=>{
 put('phase2_work/package.json',JSON.stringify({packageManager:'npm@10.9.2',engines:{node:'>=22.23.3'},scripts:{'check:enterprise':'x',typecheck:'x','test:pure':'x','test:rules':'x',build:'x'}}));
 assert.ok(screenSCAGateContract(root).findings.some(x=>x.includes('package manager no longer pinned')));
}));
test('node engine drift is rejected',()=>withFixture(({root,put})=>{
 put('phase2_work/package.json',JSON.stringify({packageManager:'bun@1.4.2',engines:{node:'>=20'},scripts:{'check:enterprise':'x',typecheck:'x','test:pure':'x','test:rules':'x',build:'x'}}));
 assert.ok(screenSCAGateContract(root).findings.some(x=>x.includes('Node.js engine')));
}));
test('policy guard tampering is rejected',()=>withFixture(({root,put})=>{
 put('phase2_work/scripts/check-dependency-locks.mjs','// policy disabled');
 assert.ok(screenSCAGateContract(root).findings.some(x=>x.includes('Bun-only policy guard missing')));
}));
test('symlinked application manifest is rejected',()=>withFixture(({root,put})=>{
 put('outside.json','{}');rmSync(join(root,'phase2_work/package.json'));symlinkSync(join(root,'outside.json'),join(root,'phase2_work/package.json'));
 assert.ok(screenSCAGateContract(root).findings.some(x=>x.includes('regular, unique, non-symlink')));
}));
test('mandatory script mapping cannot silently disappear',()=>withFixture(({root,put})=>{
 put('phase2_work/package.json',JSON.stringify({packageManager:'bun@1.4.2',engines:{node:'>=22.23.3'},scripts:{typecheck:'tsc'}}));
 assert.ok(screenSCAGateContract(root).findings.some(x=>x.includes('mandatory npm script mapping incomplete')));
}));
test('default absent binary provenance flags remain visible',()=>withFixture(({root})=>{
 const r=screenSCAGateContract(root);
 assert.ok(r.additional_review_items.some(x=>x.includes('GATE_08_PROVENANCE')));
 assert.ok(r.additional_review_items.some(x=>x.includes('GATE_09_PROVENANCE')));
}));
