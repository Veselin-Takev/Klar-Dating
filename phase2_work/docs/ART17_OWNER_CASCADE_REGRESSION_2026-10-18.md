# Art. 17 owner-referral claim deletion — mutation regression

**Date:** 2026-10-18  
**Status:** Draft / **NO-GO** — no production approval.

## Scope

The deletion cascade on draft PR #117 deletes buyer claims belonging to other users when they reference a departing owner's referral. Because buyer-claim records are keyed by `referralId`, deleting only by owner/buyer pseudonym can leave personal attribution records behind. The parent referral must survive until its child claims have been removed, allowing interrupted deletion slices to resume.

## Offline regression

From `phase2_work`, run:

```sh
node scripts/test-art17-owner-claim-cascade.mjs
```

The test copies only source files needed by `check-art17-deletion-audit.mjs` into an isolated temporary directory, validates the original baseline, then changes one condition at a time:

1. Query buyer claims via `buyerRef` instead of `referralId`.
2. Delete the parent referral before deleting its claims.
3. Remove the claim deletion statement.
4. Run buyer-claim deletion without awaiting its completion.
5. Omit deletion of the parent referral document.
6. Remove the per-referral deletion-slice guard that limits long-running pages.

Each altered fixture must make the actual Art. 17 static audit gate fail with the expected diagnostic; the original source is never modified. Temporary files are removed on completion.

## Limitations and release requirements

This proves only that the existing static gate detects these selected regressions. It does **not** prove complete Firestore deletion, concurrency/retry safety, legal-hold compliance, audit completeness, or production data integrity. Complete the pinned Node 22.23.3 tests, Firebase Emulator restart/failure-injection tests, Firestore rules, full mandatory gates, and independent Security/Privacy/Legal review before promoting PR #117 or this follow-up. Preserve the `NO-GO` release state.

## Verified offline preflight — 2026-10-18

The mandatory `npm run check:art17-deletion-audit` script now executes the existing Art. 17 static check, seven storage deletion tests, and five owner-claim mutation regressions in sequence. The test suite must stop on the first failing component.

**Actual executed evidence:** On an isolated extraction of the exact GitHub source archive at `ec8a2c9ccd5fded0806452319af0f6d54c89f215`, with the proposed package-script wiring applied identically, SHA-256-verified official Node `v22.23.3` was used. The integrated npm command returned exit 0, the seven storage tests passed, and all five negative cascade mutations were rejected. The following standalone gates also returned exit 0: `check-secrets.mjs`, `check-auth-boundary.mjs`, `check-public-firestore-rules.mjs`, `check-ai-pii-sanitizer.mjs`, and `check-art17-deletion-audit.mjs 0`.

These are offline/static tests only. They do not replace Firestore Emulator concurrency/restart tests, real TTL policy status, npm audit, full TypeScript/Vitest/Playwright/build, production telemetry, or DPO/Legal/Security approval. A paid GitHub Actions run was not manually started. **NO-GO until all mandatory gates and independent reviews have passed on the final exact commit.**

## 2026-10-18 — Per-referral slice guard

The owner-referral cleanup must call `checkDeletionSlice()` for each parent before querying its buyer claims. A single page contains up to `BATCH` referrals and may require multiple child-query batches; without this check, a resumed worker can run longer than its intended slice. The new static mutation rejects removal of that checkpoint. Interrupted operations retain parent referrals until their claims are deleted; this does not prove real Firestore concurrency or legal-hold behavior. **NO-GO** pending emulator and independent review.

## 2026-10-18 — Guard before parent deletion

Buyer-claim cleanup may span multiple batches. The owner-referral purge now checks `checkDeletionSlice()` again after awaiting the buyer-claim purge and before deleting the referral parent. If the slice expires, the referral remains as a durable pointer and retry can resume the child-first deletion. A seventh negative mutation verifies that removal of the post-child checkpoint is rejected by the static Art. 17 gate. This is not proof of live Firestore cancellation, concurrent claims, or legal-hold handling. **NO-GO** pending emulator tests and approvals.
