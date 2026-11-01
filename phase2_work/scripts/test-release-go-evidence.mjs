import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { collectReleaseApprovalFailures, mandatoryGateNames, mandatoryIntegrationNames, mandatoryP0IntegrationNames, mandatorySignoffRoles } from './release-go-evidence.mjs';

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
        signoffs: Object.fromEntries(mandatorySignoffRoles
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
for (const role of mandatorySignoffRoles) {
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

// Separate independent release ownership is not implied by any CI or operator signoff.
test('release owner is mandatory even with all other independent signatures', () => {
  const f = validFixture();
  delete f.manifest.releaseGovernance.goLiveAttestation.signoffs.ReleaseOwner;
  assert(collectReleaseApprovalFailures(f).some(x => x.includes('ReleaseOwner signoff')));
});

test('rejects an unrelated or stale ReleaseOwner commit attestation', () => {
  const f = validFixture();
  f.manifest.releaseGovernance.goLiveAttestation.signoffs.ReleaseOwner.commit = 'b'.repeat(40);
  assert(collectReleaseApprovalFailures(f).some(x => x.includes('ReleaseOwner signoff')));
});

test('rejects missing ReleaseOwner receipt evidence link', () => {
  const f = validFixture();
  delete f.manifest.releaseGovernance.goLiveAttestation.signoffs.ReleaseOwner.evidenceUrl;
  assert(collectReleaseApprovalFailures(f).some(x => x.includes('ReleaseOwner signoff')));
});

for (const role of ['Security', 'DPO', 'Legal', 'SRE']) {
  test('rejects ReleaseOwner self-signoff also used for ' + role, () => {
    const f = validFixture();
    f.manifest.releaseGovernance.goLiveAttestation.signoffs.ReleaseOwner.approver =
      ' SYNTHETIC-' + role.toUpperCase() + ' ';
    assert(collectReleaseApprovalFailures(f).some(x => x.includes('ReleaseOwner approver must differ')));
  });
}

test('release owner remains distinct under clean synthetic release fixture', () => {
  assert.deepEqual(collectReleaseApprovalFailures(validFixture()), []);
});


test('P0 #202/#254 explicit live integration proof names are all required', () => {
  assert.deepEqual(mandatoryP0IntegrationNames, [
    'tenantAdminSdkBola',
    'tenantMigrationArt17',
    'profileMediaVisibilityPolicy',
    'biometricGcsGenerationReceipts',
    'biometricRetentionDurableQueue',
    'biometricRetentionSchedulerIam',
  ]);
  assert.equal(new Set(mandatoryIntegrationNames).size, mandatoryIntegrationNames.length);
  for (const name of mandatoryP0IntegrationNames) {
    assert(mandatoryIntegrationNames.includes(name));
  }
});

for (const name of mandatoryP0IntegrationNames) {
  for (const [condition, mutate] of [
    ['not present', f => { delete f.manifest.releaseGovernance.goLiveAttestation.integrations[name]; }],
    ['skipped', f => { f.manifest.releaseGovernance.goLiveAttestation.integrations[name].status = 'SKIPPED'; }],
    ['bound to previous commit', f => { f.manifest.releaseGovernance.goLiveAttestation.integrations[name].commit = 'b'.repeat(40); }],
    ['no evidence link', f => { delete f.manifest.releaseGovernance.goLiveAttestation.integrations[name].evidenceUrl; }],
  ]) {
    test('blocks production GO if P0 integration ' + name + ' is ' + condition, () => {
      const f = validFixture();
      mutate(f);
      assert(collectReleaseApprovalFailures(f).some(x => x.includes('Integration ' + name)));
    });
  }
}

test('real repository still denies GO with every P0 evidence absent', () => {
  const manifest = JSON.parse(readFileSync('RELEASE_MANIFEST.json', 'utf8'));
  const checklist = readFileSync('GO_LIVE_CHECKLIST.md', 'utf8');
  const failures = collectReleaseApprovalFailures({
    manifest,
    checklist,
    env: { GITHUB_SHA: SHA, KLAR_PRODUCTION_RELEASE_APPROVED: 'true' },
  });
  for (const name of mandatoryP0IntegrationNames) {
    assert(failures.some(x => x.includes('Integration ' + name)));
  }
});
