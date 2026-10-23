import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { collectReleaseApprovalFailures, mandatoryGateNames, mandatoryIntegrationNames } from './release-go-evidence.mjs';

const SHA = 'a'.repeat(40);
const link = 'https://github.com/Veselin-Takev/Klar-Dating/actions/runs/123456789';
const receipt = () => ({ status: 'PASS', commit: SHA, evidenceUrl: link });

// Synthetic structures test schema behavior only; no mock PASS is a real
// external attestation or an approval of this repository.
const validFixture = () => ({
  manifest: {
    releaseEvidence: { status: 'VERIFIED' },
    releaseGovernance: {
      decision: 'GO', productionApproved: true, blockers: [],
      integrationEvidence: { overallDecision: 'GO' },
      goLiveAttestation: {
        approvedCommit: SHA,
        mandatoryGates: Object.fromEntries(mandatoryGateNames.map(name => [name, receipt()])),
        integrations: Object.fromEntries(mandatoryIntegrationNames.map(name => [name, receipt()])),
        vulnerabilities: { critical: 0, high: 0, commit: SHA, evidenceUrl: link },
        signoffs: Object.fromEntries(['Security', 'DPO', 'Legal', 'SRE']
          .map(role => [role, { approved: true, commit: SHA, approver: 'synthetic-'+role, evidenceUrl: link }])),
      },
    },
  },
  checklist: '# Synthetic checklist\n- [x] Tests reviewed\n',
  env: { KLAR_PRODUCTION_RELEASE_APPROVED: 'true', GITHUB_SHA: SHA },
});

test('synthetic, fully structured release receipts have no structural errors', () => {
  assert.deepEqual(collectReleaseApprovalFailures(validFixture()), []);
});

test('real current repository is NO-GO even if an environment variable says approved', () => {
  const actual = JSON.parse(readFileSync('RELEASE_MANIFEST.json', 'utf8'));
  const checklist = readFileSync('GO_LIVE_CHECKLIST.md', 'utf8');
  const errors = collectReleaseApprovalFailures({ manifest: actual, checklist,
    env: { KLAR_PRODUCTION_RELEASE_APPROVED: 'true', GITHUB_SHA: SHA } });
  assert(errors.some(x => x.includes('not explicitly GO')));
  assert(errors.some(x => x.includes('Unresolved governance blockers')));
  assert(errors.some(x => x.includes('14') || x.startsWith('Mandatory gate ')));
  assert(errors.length > 20);
});

for (const [name, checklist] of [
  ['empty checklist', ''],
  ['title-only checklist', '# No verified tasks\n'],
  ['asterisk unchecked item', '# Review\n* [ ] Firestore Emulator incomplete\n'],
  ['plus unchecked item', '# Review\n+ [ ] Live TTL incomplete\n'],
  ['multispace unchecked item', '# Review\n- [  ] Art.17 tests incomplete\n'],
  ['tab-space unchecked item', '# Review\n- [\t ] Security review incomplete\n'],
  ['unknown checkbox status', '# Review\n- [?] DPO approval missing\n'],
  ['mixed checked and unchecked items', '# Review\n- [x] Unit tests\n* [ ] CI runner checks\n'],
  ['numbered unchecked item', '# Review\n1. [ ] EU AI Act signoff pending\n'],
  ['numbered-parenthesis unchecked item', '# Review\n2) [ ] Final staging TTL pending\n'],
]) {
  test('rejects ' + name + ' as unverified GO checklist', () => {
    const candidate = validFixture();
    candidate.checklist = checklist;
    assert(collectReleaseApprovalFailures(candidate).some(x => x.includes('GO_LIVE_CHECKLIST.md')));
  });
}

for (const [name, mutate, expected] of [
  ['unset protected environment approval', x => { x.env.KLAR_PRODUCTION_RELEASE_APPROVED = 'false'; }, 'Protected'],
  ['missing GitHub commit SHA', x => { delete x.env.GITHUB_SHA; }, 'GITHUB_SHA'],
  ['mismatched commit', x => { x.manifest.releaseGovernance.goLiveAttestation.approvedCommit = 'b'.repeat(40); }, 'not bound'],
  ['missing environment governance approval', x => { x.manifest.releaseGovernance.productionApproved = false; }, 'not explicitly GO'],
  ['missing release evidence', x => { x.manifest.releaseEvidence.status = 'PENDING'; }, 'not VERIFIED'],
  ['unresolved release blocker', x => { x.manifest.releaseGovernance.blockers = ['Emulator not run']; }, 'Unresolved'],
  ['integration overall NO-GO', x => { x.manifest.releaseGovernance.integrationEvidence.overallDecision = 'NO-GO'; }, 'Integrated'],
  ['unchecked release checklist', x => { x.checklist = '- [ ] Live TTL confirmation pending'; }, 'GO_LIVE_CHECKLIST'],
  ['critical vulnerability', x => { x.manifest.releaseGovernance.goLiveAttestation.vulnerabilities.critical = 1; }, 'High/Critical'],
  ['high vulnerability', x => { x.manifest.releaseGovernance.goLiveAttestation.vulnerabilities.high = 1; }, 'High/Critical'],
  ['no SCA evidence', x => { delete x.manifest.releaseGovernance.goLiveAttestation.vulnerabilities.evidenceUrl; }, 'High/Critical'],
]) {
  test('denies ' + name, () => {
    const candidate = validFixture(); mutate(candidate);
    assert(collectReleaseApprovalFailures(candidate).some(x => x.includes(expected)));
  });
}
for (const name of mandatoryGateNames) {
  test('denies missing PASS on ' + name, () => {
    const f = validFixture(); f.manifest.releaseGovernance.goLiveAttestation.mandatoryGates[name].status = 'SKIPPED';
    assert(collectReleaseApprovalFailures(f).some(x => x.includes('Mandatory gate ' + name)));
  });
}
for (const name of mandatoryIntegrationNames) {
  test('denies missing live integration ' + name, () => {
    const f = validFixture(); delete f.manifest.releaseGovernance.goLiveAttestation.integrations[name];
    assert(collectReleaseApprovalFailures(f).some(x => x.includes('Integration ' + name)));
  });
}
for (const role of ['Security', 'DPO', 'Legal', 'SRE']) {
  test('denies missing independent ' + role + ' approval', () => {
    const f = validFixture(); f.manifest.releaseGovernance.goLiveAttestation.signoffs[role].approved = false;
    assert(collectReleaseApprovalFailures(f).some(x => x.includes(role)));
  });
}

test('production release entrypoint is wired to fail-closed evidence module', () => {
  const entry = readFileSync('scripts/check-production-release-approval.mjs', 'utf8');
  assert.match(entry, /collectReleaseApprovalFailures/);
  assert.match(entry, /RELEASE_MANIFEST\.json/);
  assert.match(entry, /GO_LIVE_CHECKLIST\.md/);
  const workflow = readFileSync('../.github/workflows/release.yml', 'utf8');
  assert.match(workflow, /run: node scripts\/check-production-release-approval\.mjs/);
  const scripts = JSON.parse(readFileSync('package.json', 'utf8')).scripts;
  assert.match(scripts['check:enterprise'], /npm run check:release-go-evidence/);
  assert.match(scripts['check:release-go-evidence'], /test-release-go-evidence\.mjs/);
});
