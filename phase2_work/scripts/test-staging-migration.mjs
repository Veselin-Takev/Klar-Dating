import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { compile, rehearsal, liveDryRun, evaluateWindow, sha } from './staging-migration-core.mjs';
import { simulatedAdapter, OutboxModel, schemaFixtures } from './staging-migration-simulation.mjs';
const example = JSON.parse(readFileSync(new URL('./staging-migration.example.json',import.meta.url),'utf8').replace(/^\uFEFF/,''));
const plan = patch => ({ ...structuredClone(example), ...patch });
test('plan is deterministic across object-key order; no production approval', () => {
  const p = plan(); assert.deepEqual(compile(p),compile(Object.fromEntries(Object.entries(p).reverse())));
  assert.equal(compile(p).productionApproved,false);
});
for (const [name,patch] of [
  ['production',{environment:'production'}],['same project',{projectId:example.productionProjectId}],
  ['protected default',{projectId:'striped-antler-500815-e6',productionProjectId:'another-production'}],
  ['destructive schema',{schema:{source:1,target:2,expandOnly:false,contractDuringRollbackWindow:false}}],
  ['invalid schema',{schema:{source:'1',target:'11',expandOnly:true,contractDuringRollbackWindow:false}}],
  ['real data',{privacy:{...example.privacy,dataset:'production'}}],
]) test('rejects '+name, () => assert.throws(() => compile(plan(patch))));
test('N-1 reference fixtures read both versions and preserve optional fields', () => {
  assert.deepEqual(Object.values(schemaFixtures()),[true,true,true,true]);
});
test('atomic outbox reference model replays once, preserves deletion and rejects stale writers', () => {
  const m = new OutboxModel(); m.write('one',1); m.write('deleted',1); m.write('deleted',null); m.replay(); m.replay();
  assert.equal(m.seen.size,3); assert.equal(m.target.get('deleted').deleted,true);
  m.cutover('target'); assert.throws(() => m.write('late',1,{epoch:1,authority:'source'}),/STALE_WRITE_EPOCH/);
  m.write('after',2); m.replay(); m.cutover('source');
  assert.equal(m.source.get('after').value,2); assert.equal(m.parity(),true);
});
for (const strategy of ['same-database','dual-write-outbox']) for (const scenario of ['happy-path','health-failure','error-spike'])
  test(strategy+' '+scenario+' verifies automatic rollback in simulation',async () => {
    const p = plan({strategy,scenario}); const a = simulatedAdapter(p); const events = [];
    const r = await rehearsal(p,a,{now:a.now,emit:e=>events.push(e)});
    assert.equal(r.kind,'SIMULATION_REHEARSAL'); assert.equal(r.rollbackVerified,true); assert.equal(r.productionApproved,false);
    assert.equal((await a.inspect()).targetPercent,0); assert.equal(a.model.authority,'source');
    let previous = '0'.repeat(64);
    for (const {hash,...record} of events) { assert.equal(record.previous,previous); assert.equal(hash,sha(record)); previous=hash; }
    assert.equal(r.finalJournalHash,previous);
  });
test('bad N-1 evidence prevents traffic changes',async () => {
  const p=plan(), a=simulatedAdapter(p); a.compatibility=async()=>({origin:'simulation'});
  await assert.rejects(rehearsal(p,a,{now:a.now}),/MIGRATION_NO_GO/);
  assert.equal((await a.inspect()).targetPercent,0);
});
test('failed replication preparation is rolled back, not treated as read-only failure',async () => {
  const p=plan({strategy:'dual-write-outbox'}),a=simulatedAdapter(p); let rolled=false;
  const rollback=a.rollback; a.rollback=async input=>{rolled=true;return rollback(input);};
  a.prepareReplication=async()=>{throw new Error('PARTIAL_PREPARATION');};
  await assert.rejects(rehearsal(p,a,{now:a.now}),/MIGRATION_NO_GO/); assert.equal(rolled,true);
});
test('lease release failure cannot issue a passing receipt',async () => {
  const p=plan(),a=simulatedAdapter(p); a.releaseLease=async()=>{throw new Error('LEASE_FAILURE');};
  await assert.rejects(rehearsal(p,a,{now:a.now}),/MIGRATION_NO_GO/);
});
test('missing, stale, overlapping and low-volume windows fail closed', () => {
  const p=plan(), now=200000;
  const valid={origin:'simulation',startMs:100000,endMs:160000,requests:100,errors:0,p95Ms:50,healthy:true,ready:true};
  assert.equal(evaluateWindow(p,valid,0,now),null);
  for (const patch of [{requests:0},{p95Ms:undefined},{endMs:1000},{startMs:0,endMs:60000}]) {
    assert.throws(()=>evaluateWindow(p,{...valid,...patch},0,now));
  }
  assert.throws(()=>evaluateWindow(p,valid,0,now,120000));
  assert.equal(evaluateWindow(p,{...valid,ready:false},0,now),'READINESS_FAILURE');
  assert.equal(evaluateWindow(p,{...valid,errors:6},0,now),'ERROR_RATE');
  assert.equal(evaluateWindow(p,{...valid,errors:2},0,now),'ERROR_SPIKE');
  assert.equal(evaluateWindow(p,{...valid,p95Ms:301},0,now),'P95_BREACH');
});
test('revision mismatch fails and restores source traffic',async () => {
  const p=plan(),a=simulatedAdapter(p),observe=a.observe; let count=0;
  a.observe=async input=>({...await observe(input),revision:count++ ? 'wrong-revision':p.sourceRevision});
  await assert.rejects(rehearsal(p,a,{now:a.now}),/MIGRATION_NO_GO/);
  assert.equal((await a.inspect()).targetPercent,0);
});
test('unknown mutating outcome requires reconciliation without blind rollback',async () => {
  const p=plan({operationTimeoutMs:100}),a=simulatedAdapter(p); let rolled=false;
  a.setTraffic=async()=>new Promise(()=>{}); a.rollback=async()=>{rolled=true;};
  const events=[];
  await assert.rejects(rehearsal(p,a,{now:a.now,emit:e=>events.push(e)}),/MIGRATION_NO_GO/);
  assert.equal(rolled,false); assert(events.some(e=>e.event==='MANUAL_RECONCILIATION_REQUIRED'));
});
test('simulation cannot satisfy live dry-run or live rehearsal',async () => {
  const p=plan(),a=simulatedAdapter(p);
  await assert.rejects(liveDryRun(p,a),/LIVE_ADAPTER_REQUIRED/);
  await assert.rejects(rehearsal(p,a,{live:true,dryReceipt:{kind:'SIMULATION_REHEARSAL'}}),/ADAPTER_ORIGIN/);
});
test('live dry-run is read-only and binds exact plan and adapter',async () => {
  const p=plan({privacy:{...example.privacy,reviewReference:'TEST-ONLY-REVIEW'}}),a=simulatedAdapter(p);
  a.origin='live'; a.codeSha256='a'.repeat(64);
  const inspect=a.inspect; a.inspect=async()=>({...await inspect(),origin:'live'});
  const compatibility=a.compatibility; a.compatibility=async()=>({...await compatibility(),origin:'live'});
  a.acquireLease=async()=>{throw new Error('MUST_NOT_WRITE');};
  const r=await liveDryRun(p,a,{now:()=>1000});
  assert.equal(r.kind,'LIVE_STAGING_DRY_RUN'); assert.equal(r.planHash,compile(p).planHash);
  assert.equal(r.adapterSha256,a.codeSha256); assert.equal(r.productionApproved,false);
});


test('forged, future and wrong-plan dry-run receipts cannot start live traffic',async () => {
  const p=plan({privacy:{...example.privacy,reviewReference:'TEST-ONLY'}}),a=simulatedAdapter(p);
  a.origin='live';a.codeSha256='a'.repeat(64);
  for(const receipt of [{kind:'SIMULATION_REHEARSAL'},
    {kind:'LIVE_STAGING_DRY_RUN',planHash:compile(p).planHash,adapterSha256:a.codeSha256,issuedAtMs:2000,expiresAtMs:3000},
    {kind:'LIVE_STAGING_DRY_RUN',planHash:'b'.repeat(64),adapterSha256:a.codeSha256,issuedAtMs:0,expiresAtMs:3000}])
    await assert.rejects(rehearsal(p,a,{live:true,dryReceipt:receipt,now:()=>1000}),/LIVE_DRY_RUN_REQUIRED/);
});
test('unknown outcome retains the lease for reconciliation',async () => {
  const p=plan({operationTimeoutMs:100}),a=simulatedAdapter(p);let released=false;
  a.setTraffic=async()=>new Promise(()=>{});a.releaseLease=async()=>{released=true;};
  await assert.rejects(rehearsal(p,a,{now:a.now}),/MIGRATION_NO_GO/);assert.equal(released,false);
});
test('live hosting migration rejects schema or database cutover',async () => {
  const p=plan({strategy:'dual-write-outbox'}),a=simulatedAdapter(p);a.origin='live';
  await assert.rejects(rehearsal(p,a,{live:true}),/HOSTING_ONLY_NO_SCHEMA_CHANGE/);
  await assert.rejects(liveDryRun(p,a),/HOSTING_ONLY_NO_SCHEMA_CHANGE/);
});
