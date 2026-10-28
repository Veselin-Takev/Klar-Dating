# Founding-500 existing-member eligibility guard — 2026-10-28

**Status: Draft / Production NO-GO.** Stacked on PR #178 at commit `2c05e8c4b616274007cf9addd4b0158fd32cbe1a` (in turn stacked on #177). Do not merge out of order.

## Finding and correction

The `/launch/founding-claim` transaction checked `founding500Member === true` **before** checking `isAdult`. An account whose adult eligibility is false or absent could therefore receive a successful existing-member response including its stored founding rank. This response bypassed the eligibility required for fresh claims. The handler now checks `isAdult === true` before both existing-member and new-member branches, maintaining the established `onboarding_incomplete` response for ineligible accounts. It neither removes the historical rank nor changes the authoritative age field.

## Verification and limitations

Three mock-HTTP regression scenarios cover existing users with false/missing adult eligibility and a valid adult existing member. They check status, response shape, zero business writes and no activation events. Parent PRs #177/#178 also validate pending account deletion and corrupt counters. This is a consistency guard, **not** proof that `isAdult` is backed by trusted age verification. Stage/production identity policy, Didit authority, emulator races, Art.17 cascade and independent Security/DPO approval remain mandatory. Require fresh exact-HEAD enterprise CI; no local cloud execution or production modification claimed. Rollback by reverting isolated commit. **NO-GO.**
