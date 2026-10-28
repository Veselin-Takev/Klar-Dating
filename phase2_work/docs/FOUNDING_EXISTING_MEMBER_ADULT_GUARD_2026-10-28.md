# Founding-500 existing-member eligibility guard — 2026-10-28

**Status: Draft / Production NO-GO.** Stacked on PR #178 at commit `2c05e8c4b616274007cf9addd4b0158fd32cbe1a` (in turn stacked on #177). Do not merge out of order.

## Finding and correction

The `/launch/founding-claim` transaction checked `founding500Member === true` **before** checking `isAdult`. An account whose adult eligibility is false or absent could therefore receive a successful existing-member response including its stored founding rank. This response bypassed the eligibility required for fresh claims. The handler now checks `isAdult === true` before both existing-member and new-member branches, maintaining the established `onboarding_incomplete` response for ineligible accounts. It neither removes the historical rank nor changes the authoritative age field.

## Verification and limitations

Three mock-HTTP regression scenarios cover existing users with false/missing adult eligibility and a valid adult existing member. They check status, response shape, zero business writes and no activation events. Parent PRs #177/#178 also validate pending account deletion and corrupt counters. This is a consistency guard, **not** proof that `isAdult` is backed by trusted age verification. Stage/production identity policy, Didit authority, emulator races, Art.17 cascade and independent Security/DPO approval remain mandatory. Require fresh exact-HEAD enterprise CI; no local cloud execution or production modification claimed. Rollback by reverting isolated commit. **NO-GO.**

## Additional integrity hardening — existing rank (2026-10-28)

An existing `founding500Member` flag also previously returned an arbitrary persisted `founding500Rank` value. The handler now rejects missing, null, string, non-integer, negative, non-finite and above-limit ranks (HTTP 503, no business writes or activation). Nine additional HTTP regression variants check the malformed rank and the existing valid-rank positive case remains. The authoritative cohort and member documents are deliberately **not** repaired automatically; remediation requires operator reconciliation to avoid duplicating ranks. This guards the response integrity, not historical correctness or uniqueness of ranks. A new exact-HEAD CI PASS and separate data quality review are required. Source base before this amendment: `c728d22811b15dac571d0ad0e3b4bcb6c7ded539`. NO-GO.

## Cross-document rank/counter invariant (2026-10-28)

The previous existing-member fast path skipped cohort counter validation. A stored rank could therefore exceed a missing, corrupt, or lower cohort counter and still be echoed. Now the transactional cohort count is validated before the existing-member branch, and stored rank must satisfy `1 <= rank <= min(foundingLimit, cohort.count)`. Five new negative HTTP cases cover lower/zero/missing/malformed/negative counters, with zero business writes or activation. Valid existing members retain their recorded rank. No automatic repair or renumbering is performed: operator-led reconciliation remains necessary for historical duplicate assignments. Prior exact-head CI `40705900864` passed on `e23903842c7036ef19d28d1fde2a909e70f5b8aa` but this amendment requires a new run. Production **NO-GO**.
