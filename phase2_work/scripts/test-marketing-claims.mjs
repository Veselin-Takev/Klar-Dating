import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
const root = mkdtempSync(path.join(tmpdir(),'klar-claims-'));
const original = JSON.parse(readFileSync(new URL('../docs/MARKETING_CLAIM_EVIDENCE_2026-10-18.json',import.meta.url),'utf8'));
const script = new URL('./check-marketing-claims.mjs',import.meta.url);
function run(data,release=false) {
 const file=path.join(root,'manifest.json');writeFileSync(file,JSON.stringify(data));
 return spawnSync(process.execPath,[script.pathname,...(release?['--release']:[])],{env:{...process.env,KLAR_CLAIM_MANIFEST_PATH:file},encoding:'utf8'});
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
 const sameOwner=structuredClone(good);sameOwner.claims[0].owners.legal=sameOwner.claims[0].owners.product;assert.notEqual(run(sameOwner).status,0);
 const missingGo=structuredClone(good);missingGo.releaseStatus='NO-GO';assert.equal(run(missingGo,true).status,1);
 console.log('PASS: canonical release matrix pinned; GO override denied; placeholder evidence and shared reviewers rejected');
} finally {rmSync(root,{recursive:true,force:true});}
