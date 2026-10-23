import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdtempSync, readFileSync, writeFileSync, rmSync, symlinkSync, mkdirSync, readdirSync, linkSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {sealHostEvidence} from './seal-host-gate-evidence.mjs';
const hash = str => createHash('sha256').update(str).digest('hex');
const fixture = ()=>{
  const dir=mkdtempSync(join(tmpdir(),'klar-host-seal-'));
  const cleanup=()=>rmSync(dir,{recursive:true,force:true});
  return {dir,cleanup};
};
test('closed log evidence is sealed with canonical ordered SHA256SUMS',async()=>{
 const f=fixture();try{
  writeFileSync(join(f.dir,'gate-01.log'),'output\n');
  writeFileSync(join(f.dir,'gate-01.exit-code'),'0\n');
  const r=await sealHostEvidence(f.dir);
  assert.equal(r.release_decision,'NO-GO');assert.equal(r.entries,2);
  const manifest=readFileSync(join(f.dir,'SHA256SUMS'),'utf8');
  assert.equal(manifest,`${hash('0\n')}  gate-01.exit-code\n${hash('output\n')}  gate-01.log\n`);
  assert.equal(r.manifest_sha256,hash(manifest));
  assert.deepEqual(readdirSync(f.dir).sort(),['SHA256SUMS','gate-01.exit-code','gate-01.log']);
 }finally{f.cleanup();}
});
test('nonzero failed gate logs can be preserved and sealed; no GO is given',async()=>{
 const f=fixture();try{
  writeFileSync(join(f.dir,'gate-09.exit-code'),'3\n');
  writeFileSync(join(f.dir,'gate-09.log'),'error\n');
  const r=await sealHostEvidence(f.dir);
  assert.equal(r.release_decision,'NO-GO');
  assert.match(readFileSync(join(f.dir,'SHA256SUMS'),'utf8'),/gate-09\.exit-code/);
 }finally{f.cleanup();}
});
test('existing SHA256SUMS is never overwritten',async()=>{
 const f=fixture();try{writeFileSync(join(f.dir,'SHA256SUMS'),'pre-existing\n');
  await assert.rejects(sealHostEvidence(f.dir),/already exists/);
  assert.equal(readFileSync(join(f.dir,'SHA256SUMS'),'utf8'),'pre-existing\n');
 }finally{f.cleanup();}
});
test('empty results directory cannot be sealed',async()=>{
 const f=fixture();try{await assert.rejects(sealHostEvidence(f.dir),/empty/);}finally{f.cleanup();}
});
test('symlink logs are rejected and no manifest is written',async()=>{
 const f=fixture();try{symlinkSync('/etc/passwd',join(f.dir,'gate-01.log'));
  await assert.rejects(sealHostEvidence(f.dir),/untrusted evidence entry/);
  assert(!readdirSync(f.dir).includes('SHA256SUMS'));
 }finally{f.cleanup();}
});
test('nested directories are rejected rather than being silently ignored',async()=>{
 const f=fixture();try{mkdirSync(join(f.dir,'logs'));
  await assert.rejects(sealHostEvidence(f.dir),/untrusted evidence entry/);
 }finally{f.cleanup();}
});
test('filename with traversal-unsafe whitespace is rejected',async()=>{
 const f=fixture();try{writeFileSync(join(f.dir,'bad name.txt'),'data');
  await assert.rejects(sealHostEvidence(f.dir),/untrusted evidence entry/);
 }finally{f.cleanup();}
});
test('a zero-byte log is hashed rather than omitted',async()=>{
 const f=fixture();try{writeFileSync(join(f.dir,'gate-01.log'),'');
  const r=await sealHostEvidence(f.dir);
  assert.equal(r.entries,1);
  assert.match(readFileSync(join(f.dir,'SHA256SUMS'),'utf8'),new RegExp('^'+hash('')+'  gate-01\\.log'));
 }finally{f.cleanup();}
});

test('a hard-linked evidence file is refused instead of leaking an external file through the manifest',async()=>{
 const f=fixture();try {
  const outside=join(f.dir,'original.log');
  writeFileSync(outside,'sensitive local data\n');
  linkSync(outside,join(f.dir,'gate-01.log'));
  await assert.rejects(sealHostEvidence(f.dir),/hard-linked evidence file/);
  assert(!readdirSync(f.dir).includes('SHA256SUMS'));
 }finally{f.cleanup();}
});
