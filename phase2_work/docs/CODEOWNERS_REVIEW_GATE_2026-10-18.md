# Issue #73 — CODEOWNERS governance gate (2026-10-18)

**Status: NO-GO.** The previous root CODEOWNERS patterns `/src/server/...` and `/firestore.rules` did not match the active files under `phase2_work/`. This branch maps actual paths to Security/Finance/Engineering reviewer groups.

## Required before merging
1. Verify that `@klar/engineering`, `@klar/security`, and `@klar/finance` exist as GitHub teams **and have write access to this repository**. An invalid owner entry will be ignored by GitHub.
2. Check CODEOWNERS parsing errors in GitHub and verify last-match owner behavior on each high-risk path.
3. Require branch rulesets with `require_code_owner_reviews`, status checks, dismissal on changed code, and enforce independent Security/Privacy and Finance approval where relevant. The CODEOWNERS file alone does **not** implement multi-person segregation of duties.
4. Verify that the workflows themselves do not bypass repository rules, and require exact SHA tested PRs before merge.
5. Keep #73 and #8 open until observed ruleset and required-review evidence is recorded.

No CI/CD or cloud deployment triggered intentionally; exact-head test evidence and branch protection were not inspected. This document is a static code-level safeguard only.
