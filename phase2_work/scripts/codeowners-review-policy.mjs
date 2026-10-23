// Routing ownership is not an independent specialist approval.
export const technicalOwner = '@Veselin-Takev';
export const independentReviewers = Object.freeze({
  Security: Object.freeze([]),
  Finance: Object.freeze([]),
});

const loginPattern = /^[A-Za-z0-9][A-Za-z0-9-]{0,38}$/;
const evidencePattern = /^https:\/\/github\.com\/Veselin-Takev\/Klar-Dating\/(?:pull\/\d+(?:#pullrequestreview-\d+)?|issues\/\d+(?:#issuecomment-\d+)?|actions\/runs\/\d+)$/;

/** Structural guard only: protected release review must verify the linked evidence. */
export function collectIndependentReviewFailures(manifest, commit, reviewers = independentReviewers) {
  const failures = [];
  const attest = manifest?.releaseGovernance?.goLiveAttestation;
  const assigned = {};
  if (!/^[a-f0-9]{40}$/.test(commit ?? '')) failures.push('Independent reviews require an exact commit SHA');
  for (const role of ['Security', 'Finance']) {
    const accounts = reviewers?.[role];
    if (!Array.isArray(accounts) || !accounts.length || accounts.some(account =>
      typeof account !== 'string' || !loginPattern.test(account) ||
      account.toLowerCase() === technicalOwner.slice(1).toLowerCase())) {
      failures.push('Independent ' + role + ' reviewer is unassigned or invalid; technical ownership is insufficient');
      continue;
    }
    const approval = attest?.signoffs?.[role];
    if (approval?.approved !== true || approval.commit !== commit ||
      typeof approval.approver !== 'string' ||
      !accounts.some(account => account.toLowerCase() === approval.approver.toLowerCase()) ||
      !evidencePattern.test(approval.evidenceUrl ?? '')) {
      failures.push('Independent ' + role + ' exact-commit approval from an assigned reviewer is missing');
      continue;
    }
    assigned[role] = approval.approver.toLowerCase();
  }
  if (assigned.Security && assigned.Security === assigned.Finance) {
    failures.push('Security and Finance require distinct independent reviewers');
  }
  return failures;
}
