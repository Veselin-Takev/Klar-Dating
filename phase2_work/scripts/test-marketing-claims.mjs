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
 for(const c of good.claims){c.state='approved';c.evidence=['https://github.com/org/repo/issues/111','https://github.com/org/repo/actions/runs/222'];c.owners={product:'@owner-product',legal:'@owner-legal',brand:'@owner-brand'};}
 assert.equal(run(good,true).status,0,'Structurally complete manifest should pass local shape check; real evidence still requires manual verification');
 const placeholder=structuredClone(good);placeholder.claims[0].evidence=['placeholder','https://example.com/fake'];assert.notEqual(run(placeholder,true).status,0);
 const sameOwner=structuredClone(good);sameOwner.claims[0].owners.legal=sameOwner.claims[0].owners.product;assert.notEqual(run(sameOwner,true).status,0);
 const missingGo=structuredClone(good);missingGo.releaseStatus='NO-GO';assert.equal(run(missingGo,true).status,1);
 console.log('PASS: baseline valid, blocked NO-GO, placeholder evidence denied, distinct reviewers required and explicit GO required');
} finally {rmSync(root,{recursive:true,force:true});}
