# Klar v149 — Consolidated release evidence checkpoint (2026-10-14)

## Verified repository state

- GitHub `main` at inspection: `64218ef245b2b70b74ad19c2f77046fbf6969a52` (merge PR #36).
- Pull requests #30 through #36 are merged. The CI successes observed for individual PR heads are not interchangeable with tests of the integrated branch.
- **Correction based on the user's GitHub CLI query:** exact integrated `main` commit `64218ef245b2b70b74ad19c2f77046fbf6969a52` has a successful `push` event [Klar Enterprise CI run 38476613481](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/38476613481), created 2026-10-13T22:16:07Z. The earlier commit workflow-run connector returned no runs and must not be interpreted as proof that GitHub Actions did not run. This evidence is for that **historical exact SHA**, not the current main HEAD.
- `.github/workflows/ci.yml` declares `push` on `main`. `scripts/ci-scope.mjs` requires full validation for non-pull-request events. Neither source file demonstrates why the workflow lookup is empty.
- Codespace `security/v149-autonomous-consolidation` has separate uncommitted work; its last user-reported typecheck had 724 errors. Those errors have **not** been remeasured on current GitHub `main`.

## Required release evidence, in order

1. Preserve the historical exact-main push success recorded above. For **newer** integrated main commits, check GitHub CLI `gh run list --repo Veselin-Takev/Klar-Dating --branch main --limit 20 --json databaseId,name,headSha,status,conclusion,event,createdAt` and correlate by full SHA and event before claiming missing or passed CI. The connector's empty lookup is not decisive. **Do not trigger another costly run until the approved Actions-minute balance is confirmed.**
2. If a new exact-main SHA has no appropriate existing successful run, obtain authorization for one targeted validation; reuse earlier evidence only if SHA and validation scope match. PR-head CI success alone cannot prove the newer integrated main SHA.
3. Require passing typecheck, dependency/security gates, isolated Firebase Auth/Firestore/Storage emulator tests, legal/consent/account deletion flows, browser acceptance and build. Capture failed test artifacts without exposing secrets or personal data.
4. Before reconciling the Codespace worktree, preserve tracked diff, untracked **contents** and any local secrets privately, then integrate selectively. Never `reset --hard`, force-checkout, or overwrite uncommitted work.
5. Complete live production IAM/Cloud Run and secret-rotation checks, incident alert delivery/on-call acknowledgment, monitoring, cost controls, recovery/rollback evidence and independent named signoffs as defined in [Issue #8](https://github.com/Veselin-Takev/Klar-Dating/issues/8).

## Decision

**PRODUCTION NO-GO.** Historical exact-main enterprise CI success is established for `64218ef...`, and later PR-head CI success exists (e.g. merged #41, #42 and #44); this does not establish comprehensive validation of the current main SHA, live operational evidence, or explicit human production approval. This checkpoint is a historical snapshot and must not be treated as a continuously updating status dashboard.
