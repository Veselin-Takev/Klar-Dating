# Founding cohort counter integrity — 2026-10-28

**Draft / NO-GO.** Stacked on PR #177 at `dc8b7e148cc132fa43dafcf372b43f2acd775223` because the same endpoint and regression suite are modified.

## Source finding

`POST /api/launch/founding-claim` previously used `Number(cohortSnap.data()?.count ?? 0)`. A malformed Firestore value such as string `'0'`, `NaN`, a negative number or a fractional number could be accepted or produce an invalid rank. A missing cohort document is the only valid implicit zero. The new fail-closed validation checks `Number.isSafeInteger(rawCount) && rawCount >= 0` before allocating a rank; an invalid existing counter returns the existing 503 error without cohort/user mutations or new activation events. A correct zero or valid integer maintains existing behavior.

## Regression evidence

Eight negative cases in `tests/launchEndpoint.spec.ts` model null, strings, negative/fractional, NaN, infinity and unsafe integers. They assert failure and zero business writes. Parent #177's deletion-pending and successful-claim test cases continue to apply. These are mocked HTTP tests; concurrent Firestore emulator and live staging evidence are not established. Exact-HEAD CI (typecheck, tests, build, security gates) and independent Security/SRE review required before merge. No production change or promotion authorized; rollback by reverting the isolated change. **PRODUCTION NO-GO.**
