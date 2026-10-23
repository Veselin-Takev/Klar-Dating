import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, rmSync, symlinkSync, writeFileSync, chmodSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { TARGET_COMMIT, evaluateReadiness, inspectHost } from './preflight-authorized-host-audit.mjs';

const goodImage = 'ghcr.io/approved/klar-audit:2026-10-23@sha256:' + 'a'.repeat(64);
function good() {
  return {
    checkout: {ok:true,state:'git checkout inspected',head:TARGET_COMMIT,tree:'05f22f0ca387ae37573b1f81e85ead901dce3da9',clean:true},
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
 const out=inspectHost({image:goodImage,authorizationReference:'APPROVED-BY-OWNER-REFERENCE',probe,inspectDirectory:()=>({ok:true,state:'empty private directory'}),inspectGitCheckout:()=>good().checkout});
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

// Regressions: supplied SHA is never proof of the actual tested checkout.
test('nominal target SHA without observed checkout is not readiness PASS',()=>{
 const x=good();delete x.checkout;
 finding(x,'CHECKOUT_UNAVAILABLE');
});
test('actual git HEAD different from target fails despite matching supplied SHA',()=>{
 const x=good();x.checkout={...x.checkout,head:'a'.repeat(40)};
 finding(x,'CHECKOUT_COMMIT_MISMATCH');
});
test('actual git tree different from target fails despite matching HEAD',()=>{
 const x=good();x.checkout={...x.checkout,tree:'b'.repeat(40)};
 finding(x,'CHECKOUT_TREE_MISMATCH');
});
test('modified or untracked source checkout fails closed',()=>{
 const x=good();x.checkout={...x.checkout,clean:false};
 finding(x,'CHECKOUT_DIRTY');
});
test('source checkout must be an absolute real directory',()=>{
 const d=mkdtempSync(join(tmpdir(),'klar-checkout-bad-'));
 try {
  const q=inspectHost({checkoutDir:'../relative',inspectDirectory:()=>({ok:true,state:'absent'}),probe:()=>({ok:true,output:'available'})});
  assert.ok(q.findings.some(f=>f.code==='CHECKOUT_UNAVAILABLE'));
  symlinkSync(d,join(d,'redirect'));
  const l=inspectHost({checkoutDir:join(d,'redirect'),inspectDirectory:()=>({ok:true,state:'absent'}),probe:()=>({ok:true,output:'available'})});
  assert.ok(l.findings.some(f=>f.code==='CHECKOUT_UNAVAILABLE'));
 } finally {rmSync(d,{recursive:true,force:true})}
});
test('real local test repository with wrong commit is correctly rejected without changing it',()=>{
 const d=mkdtempSync(join(tmpdir(),'klar-checkout-real-'));
 try {
  const git=(...args)=>execFileSync('git',['-C',d,...args],{encoding:'utf8',stdio:'pipe'}).trim();
  git('init','-q');
  writeFileSync(join(d,'tracked.txt'),'baseline\n');
  git('add','tracked.txt');
  execFileSync('git',['-C',d,'-c','user.name=QA','-c','user.email=qa@example.invalid','commit','-qm','baseline'],{stdio:'pipe'});
  const x=inspectHost({checkoutDir:d,inspectDirectory:()=>({ok:true,state:'absent'}),probe:(exe,args)=>exe==='git'&&args.includes('rev-parse')||exe==='git'&&args.includes('status')?{
    ok:true,output:execFileSync(exe,args,{encoding:'utf8',stdio:'pipe'}).trim()
  }:{ok:true,output:exe==='node'?'v22.23.3':exe==='bun'?'1.4.2':'available'},image:goodImage,authorizationReference:'SECURITY-RELEASE-OWNER-119'});
  assert.equal(x.observed_checkout_commit,git('rev-parse','HEAD'));
  assert.ok(x.findings.some(f=>f.code==='CHECKOUT_COMMIT_MISMATCH'));
  assert.equal(git('status','--porcelain'),'');
 } finally {rmSync(d,{recursive:true,force:true})}
});
test('untracked files in real source repository are rejected',()=>{
 const d=mkdtempSync(join(tmpdir(),'klar-checkout-dirty-'));
 try {
  const git=(...args)=>execFileSync('git',['-C',d,...args],{encoding:'utf8',stdio:'pipe'}).trim();
  git('init','-q');writeFileSync(join(d,'tracked.txt'),'source\n');git('add','tracked.txt');
  execFileSync('git',['-C',d,'-c','user.name=QA','-c','user.email=qa@example.invalid','commit','-qm','baseline'],{stdio:'pipe'});
  writeFileSync(join(d,'untracked.txt'),'unexpected');
  const x=inspectHost({checkoutDir:d,inspectDirectory:()=>({ok:true,state:'absent'}),probe:(exe,args)=>exe==='git'&&(args.includes('rev-parse')||args.includes('status'))?{
    ok:true,output:execFileSync(exe,args,{encoding:'utf8',stdio:'pipe'}).trim()
  }:{ok:true,output:exe==='node'?'v22.23.3':exe==='bun'?'1.4.2':'available'},image:goodImage,authorizationReference:'SECURITY-RELEASE-OWNER-119'});
  assert.equal(x.checkout_clean,false);
  assert.ok(x.findings.some(f=>f.code==='CHECKOUT_DIRTY'));
 } finally {rmSync(d,{recursive:true,force:true})}
});
