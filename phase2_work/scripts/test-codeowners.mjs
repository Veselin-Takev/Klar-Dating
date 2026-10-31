import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { checkCodeowners, ownersForPath, requiredOwnership } from './check-codeowners.mjs';

const source = readFileSync(new URL('../../CODEOWNERS', import.meta.url), 'utf8');

test('all 34 protected files have explicit technical routing, independent of specialist release approvals', () => {
  assert.deepEqual(checkCodeowners(source), []);
  assert.equal(Object.keys(requiredOwnership).length, 34);
});
const newlyProtected = [
  'phase2_work/src/server/routes/complianceStorage.ts',
  'phase2_work/src/server/platform/storageRetentionEngine.ts',
  'phase2_work/src/server/verification/diditKyc.ts',
  'phase2_work/functions/src/purgeVerificationStorage.ts',
  'phase2_work/functions/src/purgeCompletion.ts',
  'phase2_work/src/lib/api.ts',
  'phase2_work/src/lib/klar.ts',
  'GO_LIVE_CHECKLIST.md',
];

for (const file of newlyProtected) {
  test('fails closed when critical reviewer path is removed: ' + file, () => {
    const rule = '/' + file + ' @Veselin-Takev';
    const mutated = source.split(/\r?\n/).filter(line => line !== rule).join('\n');
    assert(checkCodeowners(mutated).some(err => err.includes(file)),
      'Mandatory literal ownership must not be replaced by generic path ownership');
  });
}
test('late catchall cannot override explicit purge and privacy ownership', () => {
  const mutated = source + '\n/phase2_work/ @Veselin-Takev\n';
  for (const file of newlyProtected.filter(p => p.startsWith('phase2_work/'))) {
    assert(checkCodeowners(mutated).some(err => err.includes(file)), file);
  }
});

test('last matching CODEOWNERS entry wins, including harmful later generic overrides', () => {
  const modified = source + '\n/phase2_work/ @Veselin-Takev\n';
  assert(checkCodeowners(modified).some(s => s.includes('authorization.ts')));
});
test('GitHub root paths do not implicitly own phase2_work files', () => {
  const oldOnly = source.split('# Active application')[0];
  assert(checkCodeowners(oldOnly).some(error => error.includes('authorization.ts')));
});
test('removing the explicit Stripe protection fails despite a global technical owner', () => {
 const modified=source.split(/\r?\n/).filter(line=>!line.startsWith('/phase2_work/src/server/stripeService.ts ')).join('\n');
 assert(checkCodeowners(modified).some(error=>error.includes('stripeService.ts')));
});

test('removing explicit Firestore protection fails despite a global technical owner', () => {
 const modified=source.split(/\r?\n/).filter(line=>!line.startsWith('/phase2_work/firestore.rules ')).join('\n');
 assert(checkCodeowners(modified).some(error=>error.includes('firestore.rules')));
});

test('a later unreviewed catchall would bypass the specialist team and is rejected', () => {
  const modified = source + '\n* @Veselin-Takev\n';
  assert(checkCodeowners(modified).length >= 5);
});

for (const pattern of [
  '/phase2_work/**',
  '**',
  '/phase2_work/src/server/*.ts',
  '/phase2_work/src/server/authorization.*',
  '/phase2_work/src/server/authorization.?s',
  '/phase2_work/src/server/[a-z]*',
]) {
  test('fail closed on GitHub glob override: ' + pattern, () => {
    const mutated = source + '\n' + pattern + ' @Veselin-Takev\n';
    assert(checkCodeowners(mutated).some(x => x.includes('unsupported CODEOWNERS pattern')));
  });
}

test('fail closed on ownerless CODEOWNERS rule', () => {
  assert(checkCodeowners(source + '\n/phase2_work/src/server/\n')
    .some(x => x.includes('missing CODEOWNERS reviewer identity')));
});

test('fail closed on malformed owner identity that GitHub might skip', () => {
  assert(checkCodeowners(source + '\n/phase2_work/src/server/ @\n')
    .some(x => x.includes('invalid or missing CODEOWNERS reviewer identity')));
});

for (const pattern of ['authorization.ts', 'phase2_work/src/server/authorization.ts']) {
  test('fail closed on unanchored CODEOWNERS override: ' + pattern, () => {
    const mutated = source + '\n' + pattern + ' @Veselin-Takev\n';
    assert(checkCodeowners(mutated).some(x => x.includes('unsupported CODEOWNERS pattern')));
  });
}

test('GitHub anchored directory without trailing slash also overrides descendants', () => {
  const mutated = source + '\n/phase2_work/src/server @Veselin-Takev\n';
  assert(checkCodeowners(mutated).some(e => e.includes('authorization.ts')));
});
test('directory prefix must respect path-segment boundaries', () => {
  const snippet = '* @Veselin-Takev\n/phase2_work/src/server @Veselin-Takev\n';
  assert.deepEqual(ownersForPath(snippet, 'phase2_work/src/serverish/authorization.ts'), ['@Veselin-Takev']);
  assert.deepEqual(ownersForPath(snippet, 'phase2_work/src/server/authorization.ts'), ['@Veselin-Takev']);
});

test('a file-specific engineering owner cannot replace the global default', () => {
  const modified = source.replace('* @Veselin-Takev', '/phase2_work/src/components/ChatView.tsx @Veselin-Takev');
  assert(checkCodeowners(modified).some(x => x.includes('repository-wide technical owner default')));
});
test('rejects malformed team path syntax before it silently stops assigning reviewers', () => {
  const modified = source + '\n/phase2_work/src/server/ @klar/.security\n';
  assert(checkCodeowners(modified).some(x => x.includes('invalid or missing CODEOWNERS reviewer identity')));
});

test('effective owner roles for every sensitive path match the exact policy contract', () => {
  for (const [file, required] of Object.entries(requiredOwnership)) {
    for (const role of required) assert(ownersForPath(source, file).includes(role), file + ': ' + role);
  }
});
test('comments and blank lines never override a sensitive owner', () => {
  const adjusted = source + '\n\n# /phase2_work/ @Veselin-Takev\n   # comment-only pattern\n';
  assert.deepEqual(checkCodeowners(adjusted), []);
});
test('a duplicate exact rule cannot substitute an unverified technical owner', () => {
  const modified = source + '\n/phase2_work/firestore.rules @unverified-reviewer\n';
  assert(checkCodeowners(modified).some(e => e.includes('unverified technical owner')));
});
test('invalid untrusted path input is refused rather than normalized', () => {
  for (const invalid of ['/phase2_work/firestore.rules', '../CODEOWNERS', 'phase2_work/../CODEOWNERS']) {
    assert.throws(() => ownersForPath(source, invalid), /Invalid repository-relative path/);
  }
});


import { technicalOwner, collectIndependentReviewFailures } from './codeowners-review-policy.mjs';
const sha='a'.repeat(40);
const evidenceUrl='https://github.com/Veselin-Takev/Klar-Dating/pull/123#pullrequestreview-456';
// Synthetic identities exercise structure only; they are not real approval evidence.
const reviewers={Security:['synthetic-security'],Finance:['synthetic-finance']};
const fixture=()=>({releaseGovernance:{goLiveAttestation:{signoffs:{
 Security:{approved:true,commit:sha,approver:reviewers.Security[0],evidenceUrl},
 Finance:{approved:true,commit:sha,approver:reviewers.Finance[0],evidenceUrl},
}}}});
test('solo ownership leaves independent Security and Finance unassigned',()=>{
 const errors=collectIndependentReviewFailures(fixture(),sha);
 assert(errors.some(error=>error.includes('Security reviewer is unassigned')));
 assert(errors.some(error=>error.includes('Finance reviewer is unassigned')));
});
test('synthetic distinct approvals satisfy only the structural contract',()=>{
 assert.deepEqual(collectIndependentReviewFailures(fixture(),sha,reviewers),[]);
});
test('technical owner cannot substitute for an independent reviewer',()=>{
 assert(collectIndependentReviewFailures(fixture(),sha,{...reviewers,Security:['vESeLiN-tAkEv']}).length>0);
});
test('stale, missing, unassigned and external evidence fails closed',()=>{
 for(const patch of [{commit:'b'.repeat(40)},{approved:false},{approver:'unassigned'},{evidenceUrl:'https://example.com/review'}]){
  const manifest=fixture();Object.assign(manifest.releaseGovernance.goLiveAttestation.signoffs.Security,patch);
  assert(collectIndependentReviewFailures(manifest,sha,reviewers).length>0);
 }
 assert(collectIndependentReviewFailures(fixture(),undefined,reviewers).length>0);
 assert(collectIndependentReviewFailures({},sha,reviewers).length>0);
});
test('one person cannot satisfy both independent roles',()=>{
 const manifest=fixture();manifest.releaseGovernance.goLiveAttestation.signoffs.Finance.approver=reviewers.Security[0];
 assert(collectIndependentReviewFailures(manifest,sha,{...reviewers,Finance:reviewers.Security}).some(error=>error.includes('distinct independent reviewers')));
});
test('unknown technical identities are rejected',()=>{
 for(const owner of ['@klar/security','@other-user'])assert(checkCodeowners(source.replaceAll(technicalOwner,owner)).some(error=>error.includes('unverified technical owner')));
});
test('every explicit critical rule is required despite the global fallback',()=>{
 for(const file of Object.keys(requiredOwnership)){
  const pattern=file==='.github/workflows/release.yml'?'/.github/workflows/':'/'+file;
  const changed=source.split(/\r?\n/).filter(line=>!line.startsWith(pattern+' ')).join('\n');
  assert(checkCodeowners(changed).some(error=>error.includes(file)),file);
 }
});
test('production entry point retains both existing evidence and independent-review checks',()=>{
 const entry=readFileSync(new URL('./check-production-release-approval.mjs',import.meta.url),'utf8');
 assert(entry.includes('collectReleaseApprovalFailures({ manifest, checklist, env: process.env })'));
 assert(entry.includes('failures.push(...collectIndependentReviewFailures(manifest, process.env.GITHUB_SHA))'));
});
