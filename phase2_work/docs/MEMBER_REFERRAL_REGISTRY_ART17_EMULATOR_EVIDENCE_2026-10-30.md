# P0 #48 — Member referral registry Art. 17 emulator deletion proof (2026-10-30)

**Status: isolated, not activated, NOT yet CI-verified. PRODUCTION BLOCKED / NO-GO.**

## Source boundary
The staged, **unconnected** `member_referral_code_registry/{code}` stores an `ownerUid`; `purgeAccountData` in `src/server/trustAndSafety.ts` already scans this collection with `where('ownerUid','==',uid)` during account deletion, and `scripts/loeschkaskade.mjs` classifies it as `geloescht`. But previous tests did **not** demonstrate its actual removal with the Firestore emulator. Source review alone was inadequate to claim compliance with Art. 17.

## Test added
`tests/accountErasure.spec.ts` now includes a new isolated `it.runIf` integration case:
- Requires local Firestore emulator + Storage emulator, nonproduction runtime, and no conflicting project-id environment variable (only `demo-klar` allowed). It must be explicitly confirmed **not skipped** in the CI log, not merely counted in the test file list.
- Creates a synthetic account, durable pending account deletion job, two owner-bound registry reservations, and a third reservation for an unrelated synthetic account (unique per-run doc IDs).
- Executes the actual `purgeAccountData(uid,requestId)` cascade; asserts both owned reservations and the account profile were deleted, and unrelated reservation remains unaltered.
- Repeats the purge with the same durable request ID to exercise idempotence and checks that the unrelated record is still untouched.
- Cleans up synthetic test resources even on failure, without accessing real users or remote Firebase.

This does **not** establish all >400-document pagination cases, a 30-day TTL service guarantee, legal-hold exceptions, interrupted lease resume, production IAM, provider-side erasure or Cloud Scheduler state. Those require independent targeted tests and staging evidence. Existing tests cover larger chat pagination and storage separately; they do not substitute for live end-to-end audit.

## Change management and gates
This is a standalone feature branch **stacked on the #223 code head**. Only synthetic test source and this documentation are added. The actual production Referral endpoints stay on the legacy flow; the registry remains unactivated with no backfill. Require exact-head Node/TypeScript, enterprise static gates, Firestore/Storage emulator, explicit test non-skipping, build/browser acceptance, and Security/DPO/Legal/Release sign-off before any functionality could be enabled. Parent Draft #223 must pass its own tests before this follow-on is reviewed or merged.

No direct `main` commits, PR #119/RC R2 changes, manual Actions workflow trigger, production reads/writes or deployment. Other P0 #48/#55/#56/#70/#202 and release #8 blockers remain. **PRODUCTION NO-GO.**
