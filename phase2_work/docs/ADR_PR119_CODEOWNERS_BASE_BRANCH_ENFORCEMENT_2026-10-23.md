# ADR — GitHub CODEOWNERS base-branch enforcement for PR #119 (2026-10-23)

**Status: Proposed, not approved. PRODUCTION NO-GO / HARD STOP.**

## Decision trigger

Actual PR #119 base branch: `test/p0-art17-owner-claim-cascade-regressions-2026-10-18`, commit `9e886c67c97201602cd969fc57dfc9bf2d019c90`; proposed head: `7fdf29010c85f16a9b38e5c93186f32e92192f3a`. Base root `CODEOWNERS` is Git blob `d3873fc1d9b44883ec6c9165125144a48683b5f2`, while head root is `3ecd92e7f5be76bf82adecb38705281fe5a92659`.

GitHub's documented behavior is to evaluate CODEOWNERS on the PR **base**, while draft PRs do not auto-request code owners. Only the head file has `phase2_work/` specialization. The audited 17 sensitive paths yielded **base 0/17** specialist roles, **head 17/17**. The result is based on immutable Git object bytes and 26/26 local structural tests. It does not prove team accounts, real approvals or branch protection. Read of `main` branch protection returned 403, and connected ruleset collection [] is not a complete administrator attestation.

## Governance alternatives — human authorization mandatory

**Preferred:** An authorized independent repository administrator resolves the intended base, reviews whether the CODEOWNERS team identifiers are valid and writable, and puts the approved policy onto the actual protected PR base using a separately reviewed, protected change procedure. Verify positive/negative reviewer routing, branch protection and distinct Security/Finance reviewers before PR readiness/merge.

**Safe default until then:** Leave PR #119 Draft and **NO-GO**. No inferred CODEOWNERS reviews, no changed target branch, no manual “approve as Security” substitution and no disabled protection.

**Explicitly out of scope:** Modifying or rebasing PR #119, changing the base or `main`, creating reviewer requests, installing a paid GitHub runner, creating merges, deploying or adjusting the policy contract on the basis of this document alone.

## Verification and rollback

The base-vs-head screen and its 26 tests are integrated **on the isolated audit branch only**, pinned to the exact two Git blobs and limited to observed anchored patterns. It intentionally reports **exit 1 / NO-GO**. 26/26 local tests passed under Node.js 22.16.0, not the mandatory 22.23.3 host. The integration changes **no base-branch CODEOWNERS enforcement**, verifies no identities and grants no release-gate credit. Revert this audit-only ADR/companion report to undo its documentation, but note that rollback cannot correct missing GitHub reviews.

**0/15 qualified host gate PASS; 0/4 authenticated independent final release approvals. Issue #73 remains OPEN.**

References: `PR119_P1_73_CODEOWNERS_BASE_BRANCH_GAP_2026-10-23.md`; https://github.com/Veselin-Takev/Klar-Dating/issues/73 .
