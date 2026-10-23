import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  analyzeBaseHead, CRITICAL_PATHS, gitBlobSha, ownersForPath,
  parseSimpleCodeowners, screenPinnedFiles, TARGET,
} from './screen-pr119-base-codeowners.mjs';

const dir = fileURLToPath(new URL('./fixtures/codeowners-pr119/', import.meta.url));
const script = fileURLToPath(new URL('./screen-pr119-base-codeowners.mjs', import.meta.url));
const bPath = join(dir,'BASE_CODEOWNERS');
const hPath = join(dir,'HEAD_CODEOWNERS');
const fs = await import('node:fs');
const base = fs.readFileSync(bPath,'utf8'), head = fs.readFileSync(hPath,'utf8');

test('source identities are exact independent GitHub CODEOWNERS blobs', () => {
  assert.equal(gitBlobSha(Buffer.from(base)),TARGET.baseBlob);
  assert.equal(gitBlobSha(Buffer.from(head)),TARGET.headBlob);
});
test('real PR119 base missing specialized review owners even though head adds them', () => {
  const result = analyzeBaseHead(base,head);
  assert.equal(result.decision,'NO-GO');
  assert.equal(result.technical_status,'BASE_CODEOWNERS_SPECIALIST_GAP');
  assert.equal(result.required_paths,17);
  assert.equal(result.base_specialist_coverage,0);
  assert.equal(result.head_specialist_coverage,17);
  assert(result.path_comparisons.every(row=>row.missingBase.length && row.missingHead.length===0));
});
test('CLI refuses a valid snapshot as release GO', () => {
  const r=spawnSync(process.execPath,[script,'--base-file',bPath,'--head-file',hPath],{encoding:'utf8',timeout:8000});
  assert.equal(r.status,1,r.stderr);
  const d=JSON.parse(r.stdout);
  assert.equal(d.production_release_decision,'NO-GO');
  assert.equal(d.base_blob_verified,true);
  assert.equal(d.source_checkout_authenticated_by_this_tool,false);
  assert.equal(d.parent_branch_protection_confirmed,false);
  assert.equal(d.independent_security_finance_reviews_confirmed,false);
});
test('even a fully covered base does not invent human or protection approvals', () => {
  const r=analyzeBaseHead(head,head);
  assert.equal(r.base_specialist_coverage,17);
  assert.equal(r.decision,'NO-GO');
  assert.equal(r.technical_status,'STATIC_BASE_PATHS_COVERED_ONLY');
});
test('real base generic engineering owner cannot count as security', () => {
  const p=parseSimpleCodeowners(base);
  const owners=ownersForPath(p.rules,'phase2_work/src/server/authorization.ts');
  assert.deepEqual(owners,['@klar/engineering']);
});
test('head finance partner coverage exists statically', () => {
  let p=parseSimpleCodeowners(head);
  let owners=ownersForPath(p.rules,'phase2_work/src/server/routes/partnerReferrals.ts');
  assert(owners.includes('@klar/security') && owners.includes('@klar/finance'));
});
for(const path of ['phase2_work/src/server/authorization.ts','phase2_work/firestore.rules','phase2_work/src/server/routes/partnerReferrals.ts','.github/workflows/release.yml','CODEOWNERS']){
  test(`base does not specialize ${path}`,()=>{
    const row=analyzeBaseHead(base,head).path_comparisons.find(r=>r.path===path);
    assert(row && row.missingBase.length>0 && row.missingHead.length===0);
  });
}
for(const pattern of ['/phase2_work/**','**','/phase2_work/src/server/*.ts','authorization.ts']){
  test('unsupported CODEOWNERS syntax fails closed: '+pattern,()=>{
    const r=analyzeBaseHead(head,head+'\n'+pattern+' @klar/engineering\n');
    assert.equal(r.technical_status,'UNSUPPORTED_SOURCE_PATTERN');
    assert(r.errors.length>0);
  });
}
test('later catchall owner override causes specialist gap',()=>{
  const r=analyzeBaseHead(head,head+'\n* @klar/engineering\n');
  assert(r.head_specialist_coverage<17);
});
test('literal directory prefix override causes specialist gap',()=>{
  const r=analyzeBaseHead(head,head+'\n/phase2_work/ @klar/engineering\n');
  assert(r.head_specialist_coverage<17);
});
test('file segment boundary remains isolated',()=>{
  const rules=parseSimpleCodeowners('* @klar/engineering\n/phase2_work/src/server/ @klar/security').rules;
  assert.deepEqual(ownersForPath(rules,'phase2_work/src/serverish/auth.ts'),['@klar/engineering']);
  assert.deepEqual(ownersForPath(rules,'phase2_work/src/server/auth.ts'),['@klar/security']);
});
test('blank and comment lines do not override CODEOWNERS',()=>{
  let r=analyzeBaseHead(base,head+'\n# */ @other/team\n\n');
  assert.equal(r.head_specialist_coverage,17);
});
for(const input of ['/CODEOWNERS','../CODEOWNERS','phase2_work/../CODEOWNERS']){
  test('path traversal/out-of-root denied: '+input,()=>{
    assert.throws(()=>ownersForPath([],input),/Invalid repository-relative path/);
  });
}
test('spoofed file cannot pass pinned Git blob identity',()=>{
  const tmp=mkdtempSync(join(tmpdir(),'klar-codeowner-probe-'));
  try{
    const altered=join(tmp,'base');
    writeFileSync(altered,base+'\n# malicious changed blob\n');
    assert.throws(()=>screenPinnedFiles(altered,hPath),/blob identity mismatch/);
  }finally{rmSync(tmp,{recursive:true,force:true});}
});
test('CLI blocks forged file before emitting trust-looking JSON',()=>{
  const tmp=mkdtempSync(join(tmpdir(),'klar-codeowner-cli-'));
  try{
    const forged=join(tmp,'base');
    writeFileSync(forged,head);
    const r=spawnSync(process.execPath,[script,'--base-file',forged,'--head-file',hPath],{encoding:'utf8',timeout:8000});
    assert.equal(r.status,2);
    assert.equal(r.stdout,'');
    assert.match(r.stderr,/identity mismatch/);
  }finally{rmSync(tmp,{recursive:true,force:true});}
});
test('CLI rejects unsupported relative path and missing input',()=>{
  for(const args of [['--base-file','CODEOWNERS','--head-file',hPath],[]]){
    const r=spawnSync(process.execPath,[script,...args],{encoding:'utf8',timeout:8000});
    assert.equal(r.status,2);
    assert.equal(r.stdout,'');
  }
});
test('critical owners reference complete risk inventory',()=>{
  assert.equal(Object.keys(CRITICAL_PATHS).length,17);
  assert.deepEqual(CRITICAL_PATHS['phase2_work/src/server/partnerReferralService.ts'],['@klar/security','@klar/finance']);
});
