import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const releaseMode = process.argv.includes('--release');
const canonicalManifest = new URL('../docs/MARKETING_CLAIM_EVIDENCE_2026-10-18.json', import.meta.url);
// Release must always evaluate the committed canonical matrix; external manifest
// paths are only for isolated local mutation tests and cannot authorize shipping.
if (releaseMode && process.env.KLAR_CLAIM_MANIFEST_PATH) {
 console.error('NO-GO: release manifest override is forbidden');
 process.exit(1);
}
const manifestPath = releaseMode ? canonicalManifest : (process.env.KLAR_CLAIM_MANIFEST_PATH ?? canonicalManifest);
const data=JSON.parse(readFileSync(manifestPath,'utf8'));
const trustedEvidence = item => {
 if (typeof item !== 'string' || item.length > 2048 || /[\s\x00-\x1f\x7f]/.test(item)) return null;
 let url;
 try { url = new URL(item); } catch { return null; }
 if (url.protocol !== 'https:' || url.hostname !== 'github.com'
   || url.username || url.password || url.port || url.search || url.hash) return null;
 const segments = url.pathname.split('/').filter(Boolean);
 if (segments[0] !== 'Veselin-Takev' || segments[1] !== 'Klar-Dating') return null;
 if (segments.length >= 4 && ['blob','commit','pull'].includes(segments[2])) return 'implementation';
 if (segments.length === 5 && segments[2] === 'actions' && segments[3] === 'runs'
   && /^\d+$/.test(segments[4])) return 'test';
 return null;
};
assert.equal(data.version,1);
assert.equal(data.issue,47);
assert.ok(['NO-GO','GO'].includes(data.releaseStatus), 'Invalid declared release status');
const required=['verification','daily_proposals','free_use','selection','referral'];
assert.deepEqual(data.claims.map(c=>c.id).sort(),required.sort());
for(const claim of data.claims){
 assert.ok(['blocked','approved'].includes(claim.state),claim.id+' invalid state');
 assert.ok(typeof claim.constraints==='string' && claim.constraints.length>25,claim.id+' needs rationale');
 assert.ok(Array.isArray(claim.evidence),claim.id+' evidence must be array');
 for(const role of ['product','legal','brand'])assert.ok(Object.hasOwn(claim.owners,role),claim.id+' missing reviewer role');
 if(claim.state==='approved'){
  assert.ok(claim.evidence.length>=2 && claim.evidence.every(item => trustedEvidence(item)),claim.id+' requires trusted Klar-Dating GitHub evidence links');
  assert.ok(claim.evidence.some(item => trustedEvidence(item) === 'implementation') && claim.evidence.some(item => trustedEvidence(item) === 'test'),claim.id+' requires implementation AND workflow-run references');
  assert.equal(new Set(claim.evidence).size, claim.evidence.length,claim.id+' cannot reuse evidence references');
  for(const role of ['product','legal','brand'])assert.ok(typeof claim.owners[role]==='string'&&/^@[A-Za-z0-9-]{1,39}$/.test(claim.owners[role]),claim.id+' must name a GitHub reviewer for '+role);
  assert.equal(new Set(Object.values(claim.owners)).size,3,claim.id+' requires distinct Product/Legal/Brand reviewers');
 }
}
const approved=data.claims.filter(c=>c.state==='approved');
if(releaseMode && (data.releaseStatus !== 'GO' || approved.length!==data.claims.length)){
 console.error('NO-GO: marketing claims are not independently evidenced and signed off');
 process.exitCode=1;
}else{
 console.log('PASS: claim manifest structurally valid; approved '+approved.length+'/'+data.claims.length+'; release '+data.releaseStatus+' (external approval not validated)');
}
