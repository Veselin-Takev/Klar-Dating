import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, writeFileSync, readFileSync, rmSync, symlinkSync, unlinkSync, linkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { REQUIRED_GATES, screenEvidence } from './verify-host-gate-evidence.mjs';

const SHA = '7fdf29010c85f16a9b38e5c93186f32e92192f3a';
const hash = (x) => createHash('sha256').update(x).digest('hex');
function fixture() {
  const dir = mkdtempSync(join(tmpdir(), 'klar-audit-evidence-'));
  const files = new Map([
    ['baseline.txt', `commit=${SHA}\nnode=v22.23.3\nbun=1.4.2\n`],
    ['host-preflight.txt', `target_sha=${SHA}\n`],
    ['container-toolchain.log', 'v22.23.3\n1.4.2\n'],
    ...['install.exit-code', 'docker-build.exit-code', 'docker-run.exit-code', 'container-toolchain.exit-code'].map(n => [n, '0\n']),
    ...['install.log', 'docker-build.log', 'docker-run.log', 'runner.stdout.log', 'runner.stderr.log', 'host.stdout.log', 'host.stderr.log'].map(n => [n, `captured ${n}\n`]),
  ]);
  const rows = ['number\tcommand\texit_code\tstatus\tlog_sha256'];
  REQUIRED_GATES.forEach((cmd, i) => {
    const id = String(i + 1).padStart(2, '0');
    const log = `fake output gate ${id}\n`;
    files.set(`gate-${id}.log`, log);
    files.set(`gate-${id}.exit-code`, '0\n');
    rows.push(`${id}\t${cmd}\t0\tPASS\t${hash(log)}`);
  });
  files.set('gates.tsv', rows.join('\n') + '\n');
  for (const [file, role] of [
    ['security', 'Security'], ['dpo-legal', 'Datenschutz/Legal'],
    ['operations-sre', 'Operations/SRE'], ['release-owner', 'Release Owner']
  ]) {
    files.set(`approval-${file}.json`, JSON.stringify({role, commit: SHA, decision: 'APPROVED', approver: 'UNVERIFIED-FIXTURE', signed_at: '2026-10-23T10:00:00Z', evidence_url: 'https://example.invalid/not-a-signature'}) + '\n');
  }
  for (const [name, text] of files) writeFileSync(join(dir, name), text);
  const refresh = () => writeFileSync(join(dir, 'SHA256SUMS'), [...files].map(([name, content]) => `${hash(content)}  ${name}`).sort().join('\n') + '\n');
  refresh();
  const cleanup = () => rmSync(dir, {recursive:true,force:true});
  return { dir, files, refresh, cleanup };
}
async function caseOf(mutator, expectedError) {
  const f=fixture();
  try {
    mutator(f);
    const r = await screenEvidence(f.dir, SHA);
    assert.equal(r.release_decision, 'NO-GO');
    assert.equal(r.technical_evidence_pass, false);
    assert(r.errors.some(e => e.includes(expectedError)), JSON.stringify(r.errors));
  } finally {f.cleanup();}
}
test('full synthetic receipt set passes structural screening ONLY, never release GO', async () => {
  const f=fixture();try {
    const r=await screenEvidence(f.dir,SHA);
    assert.equal(r.errors.length,0);
    assert.equal(r.technical_evidence_pass,true);
    assert.equal(r.release_decision,'NO-GO');
    assert.equal(r.approvals_identity_verified,false);
    assert(r.approval_receipts.every(x=>x.receipt_present && !x.identity_verified));
  } finally {f.cleanup();}
});
test('missing host results directory fails closed',async () => {
  const r=await screenEvidence('/var/tmp/definitely-not-klar-host-evidence',SHA);
  assert.equal(r.release_decision,'NO-GO');assert.equal(r.technical_evidence_pass,false);
});
test('wrong or abbreviated commit input is rejected',async () => {
  const f=fixture();try{await assert.rejects(screenEvidence(f.dir,'7fdf2901'),/full 40-digit/);}finally{f.cleanup();}
});
test('tampered log fails SHA-256 validation',async () =>caseOf(f=>writeFileSync(join(f.dir,'gate-07.log'),'TAMPERED'),'SHA256 mismatch: gate-07.log'));
test('missing log fails',async () =>caseOf(f=>unlinkSync(join(f.dir,'gate-12.log')),'unverifiable file gate-12.log'));
test('nonzero exit code fails even if checksums updated',async ()=>caseOf(f=>{f.files.set('gate-11.exit-code','2\n');writeFileSync(join(f.dir,'gate-11.exit-code'),'2\n');f.refresh()},'gate exit file nonzero: 11'));
test('wrong command fails even if whole TSV rehashed',async ()=>caseOf(f=>{const changed=f.files.get('gates.tsv').replace('npx semgrep --config=auto --error','echo PASS');f.files.set('gates.tsv',changed);writeFileSync(join(f.dir,'gates.tsv'),changed);f.refresh()},'gate row invalid or non-PASS: 09'));
test('wrong runtime fails',async()=>caseOf(f=>{const txt=f.files.get('container-toolchain.log').replace('1.4.2','1.4.1');f.files.set('container-toolchain.log',txt);writeFileSync(join(f.dir,'container-toolchain.log'),txt);f.refresh()},'container runtime mismatch'));
test('wrong commit fails',async()=>caseOf(f=>{const txt=f.files.get('baseline.txt').replace(SHA,'a'.repeat(40));f.files.set('baseline.txt',txt);writeFileSync(join(f.dir,'baseline.txt'),txt);f.refresh()},'baseline.txt must have exactly one commit='));
test('independent approval receipt may arrive after technical seal, without ever granting GO',async()=>{
  const f=fixture();try {
    f.files.delete('approval-security.json');unlinkSync(join(f.dir,'approval-security.json'));f.refresh();
    const r=await screenEvidence(f.dir,SHA);
    assert.equal(r.technical_evidence_pass,true);
    assert.equal(r.release_decision,'NO-GO');
    assert.equal(r.approvals_identity_verified,false);
    assert.equal(r.approval_receipts.find(x=>x.role==='Security').receipt_present,false);
  } finally {f.cleanup();}
});
test('invalid reviewer metadata fails even when hashed',async()=>caseOf(f=>{const txt=f.files.get('approval-security.json').replace('APPROVED','PENDING');f.files.set('approval-security.json',txt);writeFileSync(join(f.dir,'approval-security.json'),txt);f.refresh()},'approval receipt structurally invalid'));
test('extra unmanifested file fails',async()=>caseOf(f=>writeFileSync(join(f.dir,'gate-99.log'),'not hashed'),'file omitted from SHA256SUMS'));
test('unexpected gate-16 output is rejected even if hashed', async()=>caseOf(f=>{f.files.set('gate-16.log','extra\n');writeFileSync(join(f.dir,'gate-16.log'),'extra\n');f.refresh()},'unexpected numbered gate artifact'));
test('symlink to outside fails even if an extra file',async()=>caseOf(f=>symlinkSync('/etc/passwd',join(f.dir,'untrusted')),'non-regular or nested entry'));
test('manifest traversal entry rejected',async()=>caseOf(f=>writeFileSync(join(f.dir,'SHA256SUMS'),`${'a'.repeat(64)}  ../escape\n`),'malformed or noncanonical'));
test('all gates must be listed exactly once',async()=>caseOf(f=>{let txt=f.files.get('gates.tsv').trimEnd().split('\n');txt.splice(2,1);txt=txt.join('\n')+'\n';f.files.set('gates.tsv',txt);writeFileSync(join(f.dir,'gates.tsv'),txt);f.refresh()},'gates.tsv must contain exactly 15 rows'));
test('nonzero Docker runtime exit code fails despite rehashed evidence',async()=>caseOf(f=>{
  f.files.set('docker-run.exit-code','1\n');writeFileSync(join(f.dir,'docker-run.exit-code'),'1\n');f.refresh();
},'nonzero prerequisite: docker-run.exit-code'));
test('missing required toolchain evidence fails',async()=>caseOf(f=>unlinkSync(join(f.dir,'container-toolchain.log')),'unverifiable file container-toolchain.log'));
test('manifest gate hash mismatch fails even with corrected manifest hash',async()=>caseOf(f=>{
  const txt=f.files.get('gates.tsv').replace(hash('fake output gate 04\n'),'a'.repeat(64));
  f.files.set('gates.tsv',txt);writeFileSync(join(f.dir,'gates.tsv'),txt);f.refresh();
},'gate log hash differs from manifest: 04'));
test('required gate log symlink outside evidence is rejected',async()=>caseOf(f=>{
  unlinkSync(join(f.dir,'gate-01.log'));symlinkSync('/etc/passwd',join(f.dir,'gate-01.log'));
},'non-regular or nested entry: gate-01.log'));
test('host preflight target commit mismatch fails',async()=>caseOf(f=>{
  const txt=f.files.get('host-preflight.txt').replace(SHA,'a'.repeat(40));
  f.files.set('host-preflight.txt',txt);writeFileSync(join(f.dir,'host-preflight.txt'),txt);f.refresh();
},'host-preflight.txt must have exactly one target_sha='));
test('receipt without identity proof can never authorize GO',async()=>{const f=fixture();try{const r=await screenEvidence(f.dir,SHA);assert.equal(r.release_decision,'NO-GO');assert.equal(r.approvals_identity_verified,false);}finally{f.cleanup();}});

// Duplicate but conflicting identity assertions must never pass inclusion checks.
test('contradictory duplicate baseline commit rejected even with correct SHA also present', async()=>caseOf(f=>{
 const text=f.files.get('baseline.txt')+`commit=${'a'.repeat(40)}\n`;
 f.files.set('baseline.txt',text);writeFileSync(join(f.dir,'baseline.txt'),text);f.refresh();
},'baseline.txt must have exactly one commit='));
test('contradictory duplicate Node runtime rejected even when expected runtime is also present', async()=>caseOf(f=>{
 const text=f.files.get('baseline.txt')+'node=v22.16.0\n';
 f.files.set('baseline.txt',text);writeFileSync(join(f.dir,'baseline.txt'),text);f.refresh();
},'baseline.txt must have exactly one node='));
test('duplicate identical Bun declaration rejected',async()=>caseOf(f=>{
 const text=f.files.get('baseline.txt')+'bun=1.4.2\n';
 f.files.set('baseline.txt',text);writeFileSync(join(f.dir,'baseline.txt'),text);f.refresh();
},'baseline.txt must have exactly one bun='));
test('contradictory duplicate target SHA rejected despite one correct line',async()=>caseOf(f=>{
 const text=f.files.get('host-preflight.txt')+'target_sha='+'a'.repeat(40)+'\n';
 f.files.set('host-preflight.txt',text);writeFileSync(join(f.dir,'host-preflight.txt'),text);f.refresh();
},'host-preflight.txt must have exactly one target_sha='));
test('no approval receipt files can screen technical evidence but never release',async()=>{
 const f=fixture();try{
  for(const name of [...f.files.keys()].filter(n=>n.startsWith('approval-'))){f.files.delete(name);unlinkSync(join(f.dir,name));}
  f.refresh();const r=await screenEvidence(f.dir,SHA);
  assert.equal(r.technical_evidence_pass,true);assert.equal(r.release_decision,'NO-GO');
  assert(r.approval_receipts.every(x=>!x.receipt_present&&!x.identity_verified));
 }finally{f.cleanup();}
});

test('a hard-linked gate log is rejected even if its content and SHA256SUMS are consistent', async()=>{
  const f=fixture();try {
    const alias=join(f.dir,'gate-01.log');
    const elsewhere=join(f.dir,'independent-evidence.log');
    const contents=f.files.get('gate-01.log');
    writeFileSync(elsewhere,contents);
    unlinkSync(alias);
    linkSync(elsewhere,alias);
    f.files.set('independent-evidence.log',contents);
    f.refresh();
    const r=await screenEvidence(f.dir,SHA);
    assert.equal(r.technical_evidence_pass,false);
    assert(r.errors.some(x=>x.includes('hard-linked evidence file: gate-01.log')),JSON.stringify(r.errors));
    assert.equal(r.release_decision,'NO-GO');
  } finally {f.cleanup();}
});

test('empty gate output is incomplete even with a matching log hash and exit code zero',async()=>caseOf(f=>{
  const log='gate-05.log',body='';
  const lines=f.files.get('gates.tsv').split('\n');
  const row=lines[5].split('\t');
  row[4]=hash(body);
  lines[5]=row.join('\t');
  const tsv=lines.join('\n');
  f.files.set('gates.tsv',tsv);
  f.files.set(log,body);
  writeFileSync(join(f.dir,'gates.tsv'),tsv);
  writeFileSync(join(f.dir,log),body);
  f.refresh();
},'empty mandatory gate log: 05'));

test('oversized semantic metadata cannot be parsed as trusted evidence',async()=>caseOf(f=>{
  const body=f.files.get('baseline.txt')+'comment='+('x'.repeat(2_000_010))+'\n';
  f.files.set('baseline.txt',body);
  writeFileSync(join(f.dir,'baseline.txt'),body);
  f.refresh();
},'not a bounded file: baseline.txt'));

// Large original host logs are valid evidence; only parsed metadata has a 2 MB cap.
test('valid mandatory gate log larger than 2 MB is streamed, not rejected as metadata', async () => {
  const f = fixture();
  try {
    const name = 'gate-09.log';
    const body = 'scanner completed successfully\n' + 'X'.repeat(2_200_000);
    f.files.set(name, body);
    writeFileSync(join(f.dir, name), body);
    const rows = f.files.get('gates.tsv').split('\n');
    const row = rows[9].split('\t');
    row[4] = hash(body);
    rows[9] = row.join('\t');
    f.files.set('gates.tsv', rows.join('\n'));
    writeFileSync(join(f.dir, 'gates.tsv'), f.files.get('gates.tsv'));
    f.refresh();
    const result = await screenEvidence(f.dir, SHA);
    assert.equal(result.technical_evidence_pass, true, JSON.stringify(result.errors));
    assert.equal(result.release_decision, 'NO-GO');
  } finally { f.cleanup(); }
});

test('valid stdout log larger than 2 MB is streamed, not rejected as metadata', async () => {
  const f = fixture();
  try {
    const name = 'runner.stdout.log';
    const body = 'long output\n' + 'Y'.repeat(2_200_000);
    f.files.set(name, body);
    writeFileSync(join(f.dir, name), body);
    f.refresh();
    const result = await screenEvidence(f.dir, SHA);
    assert.equal(result.technical_evidence_pass, true, JSON.stringify(result.errors));
    assert.equal(result.release_decision, 'NO-GO');
  } finally { f.cleanup(); }
});

test('large log corruption is still detected by full streamed SHA-256', async () => {
  const f = fixture();
  try {
    const name = 'gate-07.log';
    const original = 'Z'.repeat(2_200_000);
    f.files.set(name, original);
    writeFileSync(join(f.dir, name), original);
    f.refresh();
    writeFileSync(join(f.dir, name), original.slice(0, -1) + 'Y');
    const result = await screenEvidence(f.dir, SHA);
    assert.equal(result.technical_evidence_pass, false);
    assert(result.errors.some(e => e.includes('SHA256 mismatch: gate-07.log')), JSON.stringify(result.errors));
    assert.equal(result.release_decision, 'NO-GO');
  } finally { f.cleanup(); }
});

test('missing host stderr log still fails even without bounded re-read', async () => caseOf(f => {
  f.files.delete('host.stderr.log');
  unlinkSync(join(f.dir, 'host.stderr.log'));
  f.refresh();
}, 'required log missing from SHA256SUMS: host.stderr.log'));
