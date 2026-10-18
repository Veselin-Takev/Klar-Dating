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

Each altered fixture must make the actual Art. 17 static audit gate fail with the expected diagnostic; the original source is never modified. Temporary files are removed on completion.

## Limitations and release requirements

This proves only that the existing static gate detects these selected regressions. It does **not** prove complete Firestore deletion, concurrency/retry safety, legal-hold compliance, audit completeness, or production data integrity. Complete the pinned Node 22.23.3 tests, Firebase Emulator restart/failure-injection tests, Firestore rules, full mandatory gates, and independent Security/Privacy/Legal review before promoting PR #117 or this follow-up. Preserve the `NO-GO` release state.
