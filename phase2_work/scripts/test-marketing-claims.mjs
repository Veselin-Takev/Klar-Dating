import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
const root = mkdtempSync(path.join(tmpdir(),'klar-claims-'));
const original = JSON.parse(readFileSync(new URL('../docs/MARKETING_CLAIM_EVIDENCE_2026-10-18.json',import.meta.url),'utf8'));
const script = new URL('./check-marketing-claims.mjs',import.meta.url);
function run(data,release=false) {
 const file=path.join(root,'manifest.json');writeFileSync(file,JSON.stringify(data));
 return spawnSync(process.execPath,[fileURLToPath(script),...(release?['--release']:[])],{env:{...process.env,KLAR_CLAIM_MANIFEST_PATH:file},encoding:'utf8'});
}
try {
 const base=run(original);assert.equal(base.status,0,base.stderr);
 const blocked=run(original,true);assert.equal(blocked.status,1);assert.match(blocked.stderr,/NO-GO/);
 const good=structuredClone(original);good.releaseStatus='GO';
 for(const c of good.claims){c.state='approved';c.evidence=['https://github.com/Veselin-Takev/Klar-Dating/pull/90','https://github.com/Veselin-Takev/Klar-Dating/actions/runs/222'];c.owners={product:'@owner-product',legal:'@owner-legal',brand:'@owner-brand'};}
 assert.equal(run(good).status,0,'Structurally complete test fixture is valid for non-release mode');
 const override=run(good,true);
 assert.equal(override.status,1,'Release must reject alternate manifest even when it claims GO');
 assert.match(override.stderr,/release manifest override is forbidden/);
 const placeholder=structuredClone(good);placeholder.claims[0].evidence=['placeholder','https://example.com/fake'];assert.notEqual(run(placeholder).status,0);
 const foreign=structuredClone(good);
 foreign.claims[0].evidence[0]='https://evil.example/security/review';
 assert.notEqual(run(foreign).status,0,'External evidence URLs must be rejected');
 const credentials=structuredClone(good);
 credentials.claims[0].evidence[0]='https://attacker@github.com/Veselin-Takev/Klar-Dating/pull/90';
 assert.notEqual(run(credentials).status,0,'Embedded URL credentials must be rejected');
 const missingCi=structuredClone(good);
 missingCi.claims[0].evidence[1]='https://github.com/Veselin-Takev/Klar-Dating/pull/89';
 assert.notEqual(run(missingCi).status,0,'Implementation citations alone cannot replace test results');
 const fakePull=structuredClone(good);
 fakePull.claims[0].evidence[0]='https://github.com/Veselin-Takev/Klar-Dating/pull/not-a-real-number';
 assert.notEqual(run(fakePull).status,0,'PR number must be numeric');
 const fakeCommit=structuredClone(good);
 fakeCommit.claims[0].evidence[0]='https://github.com/Veselin-Takev/Klar-Dating/commit/placeholder';
 assert.notEqual(run(fakeCommit).status,0,'Commit SHA must be full-length');
 const encoded=structuredClone(good);
 encoded.claims[0].evidence[0]='https://github.com/Veselin-Takev/Klar-Dating/pull/%39%30';
 assert.notEqual(run(encoded).status,0,'Encoded ambiguous references must be rejected');
 const badRun=structuredClone(good);
 badRun.claims[0].evidence[1]='https://github.com/Veselin-Takev/Klar-Dating/actions/runs/placeholder';
 assert.notEqual(run(badRun).status,0,'Workflow run ID must be numeric');
 const sha='a'.repeat(40);
 for (const reference of [
  'https://github.com/Veselin-Takev/Klar-Dating/blob/'+sha+'/README.md',
  'https://github.com/Veselin-Takev/Klar-Dating/blob/'+sha+'/phase2_work/src/App.tsx',
  'https://github.com/Veselin-Takev/Klar-Dating/commit/'+sha,
 ]) {
  const valid=structuredClone(good);valid.claims[0].evidence[0]=reference;
  assert.equal(run(valid).status,0,'Valid pinned implementation reference: '+reference);
 }
 for (const reference of [
  'https://github.com/Veselin-Takev/Klar-Dating/pull/1/../90',
  'https://github.com/Veselin-Takev/Klar-Dating/pull/1/%2e%2e/90',
  'https://github.com/Veselin-Takev/Klar-Dating/pull/./90',
  'https://github.com:443/Veselin-Takev/Klar-Dating/pull/90',
  'https://github.com/Veselin-Takev/Klar-Dating/pull/0',
  'https://github.com/Veselin-Takev/Klar-Dating/pull/090',
  'https://github.com/Veselin-Takev/Klar-Dating/blob/'+sha,
  'https://github.com/Veselin-Takev/Klar-Dating/blob/'+sha+'/',
  'https://github.com/Veselin-Takev/Klar-Dating/pull/90?fake=1',
  'https://github.com/Veselin-Takev/Klar-Dating/pull/90#fake',
  'https://github.com/Veselin-Takev/Klar-Dating/pull//90',
  'https://github.com/Veselin-Takev/Klar-Dating/pull\\90',
 ]) {
  const invalid=structuredClone(good);invalid.claims[0].evidence[0]=reference;
  assert.notEqual(run(invalid).status,0,'Ambiguous resource spelling must be rejected: '+reference);
 }
 const aliasedReviewer=structuredClone(good);aliasedReviewer.claims[0].owners.legal='@OWNER-PRODUCT';
 assert.notEqual(run(aliasedReviewer).status,0,'Reviewer identity is case-insensitive');
 const canonicalEnv={...process.env};delete canonicalEnv.KLAR_CLAIM_MANIFEST_PATH;
 const canonical=spawnSync(process.execPath,[fileURLToPath(script),'--release'],{env:canonicalEnv,encoding:'utf8'});
 assert.equal(canonical.status,1);assert.match(canonical.stderr,/marketing claims are not independently evidenced/);
 const packageJson=JSON.parse(readFileSync(new URL('../package.json',import.meta.url),'utf8'));
 assert.match(packageJson.scripts['check:enterprise'],/npm run check:marketing-claims/);
 assert.match(packageJson.scripts['check:marketing-claims'],/check-marketing-claims.mjs/);
 assert.match(packageJson.scripts['check:marketing-claims'],/test-marketing-claims.mjs/);
 const production=spawnSync(process.execPath,[fileURLToPath(new URL('./check-production-release-approval.mjs',import.meta.url))],{env:{...process.env,KLAR_CLAIM_MANIFEST_PATH:path.join(root,'manifest.json')},encoding:'utf8'});
 assert.equal(production.status,1);assert.match(production.stderr,/Marketing claims release gate failed: NO-GO: release manifest override is forbidden/);
 const sameOwner=structuredClone(good);sameOwner.claims[0].owners.legal=sameOwner.claims[0].owners.product;assert.notEqual(run(sameOwner).status,0);
 const missingGo=structuredClone(good);missingGo.releaseStatus='NO-GO';assert.equal(run(missingGo,true).status,1);
 console.log('PASS: canonical release matrix pinned; GO override denied; placeholder evidence and shared reviewers rejected');
} finally {rmSync(root,{recursive:true,force:true});}
