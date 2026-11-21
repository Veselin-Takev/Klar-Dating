/**
 * Structural release attestation checks, not authentication or an independent
 * substitute for GitHub protected-environment approval / live evidence review.
 * A PDF claiming GO is never itself acceptable machine-verifiable evidence.
 */
export const mandatoryGateNames = Object.freeze([
  'npm run check:enterprise',
  'node scripts/check-secrets.mjs',
  'node scripts/check-auth-boundary.mjs',
  'node scripts/check-public-firestore-rules.mjs',
  'node scripts/check-ai-pii-sanitizer.mjs',
  'node scripts/check-art17-deletion-audit.mjs 0',
  'npm audit --audit-level=high',
  'npx gitleaks detect --source . --no-git',
  'npx semgrep --config=auto --error',
  'npm run typecheck',
  'npm run test:pure',
  'npm run test:rules',
  'npx playwright test',
  'npm run build',
]);

export const mandatoryIntegrationNames = Object.freeze([
  'firestoreRules', 'art17CascadeTransactions', 'ttlActiveStaging',
  'retentionLegalHolds', 'webhookSignatureReplay', 'cspDeployedHeaders',
  'euAiActArticle5', 'euAiActArticle50', 'gdprArticle9Pii',
  'serverIdempotency', 'sastAndSecrets', 'supplyChainAndProvenance',
  'githubRunnerAndCi',
]);

export const mandatorySignoffRoles = Object.freeze(['Security', 'DPO', 'Legal', 'SRE', 'ReleaseOwner']);

const shaPattern = /^[a-f0-9]{40}$/;
const evidencePattern = /^https:\/\/[^\s/?#]+\/\S{7,}$/;

/**
 * Return every fail-closed reason. The positive structural case is NOT a real
 * release approval: callers must independently verify linked runs and signatures.
 */
export function collectReleaseApprovalFailures({ manifest, checklist, env = {} }) {
  const failures = [];
  const governance = manifest?.releaseGovernance;
  const attest = governance?.goLiveAttestation;
  const commit = env.GITHUB_SHA;

  if (env.KLAR_PRODUCTION_RELEASE_APPROVED !== 'true') {
    failures.push('Protected production approval variable is not true');
  }
  if (!shaPattern.test(commit ?? '')) failures.push('Exact GITHUB_SHA must be a 40-character commit SHA');
  if (governance?.decision !== 'GO' || governance?.productionApproved !== true) {
    failures.push('Repository release governance is not explicitly GO and approved');
  }
  if (manifest?.releaseEvidence?.status !== 'VERIFIED') failures.push('Immutable release evidence is not VERIFIED');
  if (!Array.isArray(governance?.blockers) || governance.blockers.length !== 0) failures.push('Unresolved governance blockers');
  if (governance?.integrationEvidence?.overallDecision !== 'GO') failures.push('Integrated release evidence is not GO');
  if (attest?.approvedCommit !== commit || !shaPattern.test(attest?.approvedCommit ?? '')) {
    failures.push('GO attestation is missing or not bound to the exact commit SHA');
  }
  // A blank file, alternate Markdown list markers and multi-space unchecked
  // boxes must never count as a completed production release checklist.
  // Valid checked states are [x] or [X]; any other task state denies GO.
  const taskMarkers = typeof checklist === 'string'
    ? [...checklist.matchAll(/^\s*(?:[-*+]|\d+[.)])\s*\[([^\]\r\n]*)\]/gm)]
    : [];
  if (taskMarkers.length === 0 || taskMarkers.some(([, marker]) => !/^[xX]$/.test(marker))) {
    failures.push('GO_LIVE_CHECKLIST.md has unresolved, malformed or missing checklist items');
  }

  const completedEvidence = (name, item) => {
    if (item?.status !== 'PASS' || item.commit !== commit || !evidencePattern.test(item.evidenceUrl ?? '')) {
      failures.push(name + ': no exact-commit PASS and independent evidence link');
    }
  };
  for (const name of mandatoryGateNames) completedEvidence('Mandatory gate ' + name, attest?.mandatoryGates?.[name]);
  for (const name of mandatoryIntegrationNames) completedEvidence('Integration ' + name, attest?.integrations?.[name]);

  const vulnerabilities = attest?.vulnerabilities;
  if (vulnerabilities?.critical !== 0 || vulnerabilities?.high !== 0 ||
    vulnerabilities?.commit !== commit || !evidencePattern.test(vulnerabilities?.evidenceUrl ?? '')) {
    failures.push('High/Critical dependency security evidence not clean for this commit');
  }
  for (const role of mandatorySignoffRoles) {
    const approval = attest?.signoffs?.[role];
    if (approval?.approved !== true || approval.commit !== commit ||
      typeof approval.approver !== 'string' || !approval.approver.trim() ||
      !evidencePattern.test(approval.evidenceUrl ?? '')) {
      failures.push('Independent ' + role + ' signoff not recorded for exact commit');
    }
  }
  // Release ownership must not be self-certified by one of the independent
  // Security, Privacy/Legal or Operations approvers. This is a structural
  // separation-of-duties check, not authentication of the linked signatures.
  const signoffs = attest?.signoffs;
  const releaseOwner = typeof signoffs?.ReleaseOwner?.approver === 'string'
    ? signoffs.ReleaseOwner.approver.trim().toLowerCase() : '';
  if (releaseOwner && mandatorySignoffRoles.filter(role => role !== 'ReleaseOwner').some(role =>
    typeof signoffs?.[role]?.approver === 'string' &&
    signoffs[role].approver.trim().toLowerCase() === releaseOwner)) {
    failures.push('ReleaseOwner approver must differ from all independent Security, DPO, Legal and SRE approvers');
  }
  return failures;
}
