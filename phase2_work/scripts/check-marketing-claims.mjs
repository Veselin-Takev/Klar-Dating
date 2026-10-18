import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const data=JSON.parse(readFileSync(new URL('../docs/MARKETING_CLAIM_EVIDENCE_2026-10-18.json', import.meta.url),'utf8'));
assert.equal(data.version,1);
assert.equal(data.issue,47);
assert.equal(data.releaseStatus,'NO-GO');
const required=['verification','daily_proposals','free_use','selection','referral'];
assert.deepEqual(data.claims.map(c=>c.id).sort(),required.sort());
for(const claim of data.claims){
 assert.ok(['blocked','approved'].includes(claim.state),claim.id+' invalid state');
 assert.ok(typeof claim.constraints==='string' && claim.constraints.length>25,claim.id+' needs rationale');
 assert.ok(Array.isArray(claim.evidence),claim.id+' evidence must be array');
 for(const role of ['product','legal','brand'])assert.ok(Object.hasOwn(claim.owners,role),claim.id+' missing reviewer role');
 if(claim.state==='approved'){
  assert.ok(claim.evidence.length>0,claim.id+' cannot be approved without evidence');
  for(const role of ['product','legal','brand'])assert.ok(typeof claim.owners[role]==='string'&&claim.owners[role].trim(),claim.id+' missing '+role+' signoff');
 }
}
const approved=data.claims.filter(c=>c.state==='approved');
if(process.argv.includes('--release') && approved.length!==data.claims.length){
 console.error('NO-GO: marketing claims are not independently evidenced and signed off');
 process.exitCode=1;
}else{
 console.log('PASS: claim manifest valid; approved '+approved.length+'/'+data.claims.length+'; release '+(approved.length===data.claims.length?'review required':'BLOCKED'));
}
