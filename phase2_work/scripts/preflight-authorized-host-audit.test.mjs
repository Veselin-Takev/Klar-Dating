import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, rmSync, symlinkSync, writeFileSync, chmodSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { TARGET_COMMIT, evaluateReadiness, inspectHost } from './preflight-authorized-host-audit.mjs';

const goodImage = 'ghcr.io/approved/klar-audit:2026-10-23@sha256:' + 'a'.repeat(64);
function good() {
  return {
    commit: TARGET_COMMIT, node: 'v22.23.3', bun: '1.4.2', image: goodImage,
    authorizationReference: 'SECURITY-AND-RELEASE-OWNER-TICKET-119',
    probes: Array.from({length:5},()=>({ok:true,output:'available'})),
    results: {ok:true,state:'absent'},
  };
}
function finding(args, code) { assert.ok(evaluateReadiness(args).findings.some(f=>f.code===code),code); }

test('nominal check passes prerequisites but never returns release GO or authenticated authorization',()=>{
 const o=evaluateReadiness(good());
 assert.equal(o.technical_preflight_pass,true);assert.equal(o.release_decision,'NO-GO');
 assert.equal(o.execution_authorized,false);assert.equal(o.approvals_identity_verified,false);
});
test('wrong SHA fails closed',()=>finding({...good(),commit:'b'.repeat(40)},'COMMIT_MISMATCH'));
test('wrong Node fails closed',()=>finding({...good(),node:'v22.16.0'},'NODE_MISMATCH'));
test('wrong Bun fails closed',()=>finding({...good(),bun:null},'BUN_MISMATCH'));
test('missing authorization reference fails closed',()=>finding({...good(),authorizationReference:undefined},'AUTHORIZATION_REFERENCE_MISSING'));
test('unpinned tag fails closed',()=>finding({...good(),image:'node:22.23.3'},'IMAGE_UNPINNED'));
test('malformed hash fails closed',()=>finding({...good(),image:'node:22.23.3@sha256:xyz'},'IMAGE_UNPINNED'));
test('missing Docker daemon fails closed',()=>{const x=good();x.probes[4]={ok:false};finding(x,'DOCKER_DAEMON_UNAVAILABLE')});
test('failed required host tool fails closed',()=>{const x=good();x.probes[2]={ok:false};finding(x,'TOOL_SHA256SUM_2_UNAVAILABLE')});
test('insecure results fail closed',()=>finding({...good(),results:{ok:false,state:'world readable'}},'RESULTS_UNSAFE'));
test('host probes are read-only, invoked through arrays, and produce expected observations',()=>{
 const requested=[];
 const probe=(exe,args)=>{requested.push([exe,...args]); return {ok:true,output:exe==='node'?'v22.23.3':exe==='bun'?'1.4.2':'available'};};
 const out=inspectHost({image:goodImage,authorizationReference:'APPROVED-BY-OWNER-REFERENCE',probe,inspectDirectory:()=>({ok:true,state:'empty private directory'})});
 assert.equal(out.technical_preflight_pass,true);
 assert.deepEqual(requested.map(x=>x[0]),['node','bun','git','bash','sha256sum','docker','docker']);
 assert.equal(out.release_decision,'NO-GO');
});
test('real read-only check rejects nonempty result directory',()=>{
 const dir=mkdtempSync(join(tmpdir(),'klar-preflight-'));
 try {chmodSync(dir,0o700);writeFileSync(join(dir,'prior.log'),'old');
   const out=inspectHost({resultsDir:dir,probe:()=>({ok:true,output:'available'}),image:goodImage,authorizationReference:'PR119-RELEASE-OWNER-REFERENCE'});
   finding({...good(),results:{ok:false,state:out.results_directory}},'RESULTS_UNSAFE');
   assert.match(out.results_directory,/pre-existing files/);
 } finally {rmSync(dir,{recursive:true,force:true});}
});
test('real read-only check rejects symlink result directory',()=>{
 const dir=mkdtempSync(join(tmpdir(),'klar-preflight-'));
 try{const target=join(dir,'results');mkdirSync(target, {mode:0o700});symlinkSync(target,join(dir,'link'));
  const out=inspectHost({resultsDir:join(dir,'link'),probe:()=>({ok:true,output:'available'}),image:goodImage,authorizationReference:'PR119-RELEASE-OWNER-REFERENCE'});
  assert.match(out.results_directory,/not a real directory/);
 }finally{rmSync(dir,{recursive:true,force:true})}
});
test('dangling symlink is not mistaken for an absent directory',()=>{
 const dir=mkdtempSync(join(tmpdir(),'klar-preflight-'));
 try {symlinkSync(join(dir,'missing'),join(dir,'link'));
  const out=inspectHost({resultsDir:join(dir,'link'),probe:()=>({ok:true,output:'available'}),image:goodImage,authorizationReference:'PR119-RELEASE-OWNER-REFERENCE'});
  assert.equal(out.technical_preflight_pass,false);
 } finally {rmSync(dir,{recursive:true,force:true})}
});
test('insecure permission mode is rejected',()=>{
 const dir=mkdtempSync(join(tmpdir(),'klar-preflight-'));
 try {chmodSync(dir,0o755);
  const out=inspectHost({resultsDir:dir,probe:()=>({ok:true,output:'available'}),image:goodImage,authorizationReference:'PR119-RELEASE-OWNER-REFERENCE'});
  assert.match(out.results_directory,/owner-only/);
 } finally {rmSync(dir,{recursive:true,force:true})}
});
test('no positional arguments that imply an audit run are accepted by CLI',()=>{
 const script=resolve(import.meta.dirname,'preflight-authorized-host-audit.mjs');
 const run=spawnSync(process.execPath,[script,'--execute'],{encoding:'utf8'});
 assert.equal(run.status,2);assert.match(run.stderr,/Usage/);
});
test('CLI on this runner never grants GO and emits valid JSON even on failed preflight',()=>{
 const script=resolve(import.meta.dirname,'preflight-authorized-host-audit.mjs');
 const run=spawnSync(process.execPath,[script],{encoding:'utf8',timeout:12000});
 assert.equal(run.status,1);
 const out=JSON.parse(run.stdout);
 assert.equal(out.release_decision,'NO-GO');
 assert.equal(out.execution_authorized,false);
 assert.equal(out.technical_preflight_pass,false);
});
