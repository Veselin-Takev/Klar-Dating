# P0 #48 — Art. 17 member-code registry 401-record batch boundary

**2026-10-30 — DRAFT / CI UNVERIFIED — PRODUCTION BLOCKED / NO-GO**

## Verified prior evidence
The parent [Draft #224](https://github.com/Veselin-Takev/Klar-Dating/pull/224), exact source commit `d7879388c132791af36a881442423eca761f2d4b`, passed [Enterprise CI #41131274481](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/41131274481), validate job `124322518155`, **completed/success** with no failed steps. The original job log **explicitly executed** `purges only owned member-code reservations and is idempotent under Art. 17` in `accountErasure.spec.ts (4 tests)`: 1480/1480 tests and 203/203 test files passed.

That test covers **two** owner-bound registry documents and one foreign owner, including idempotent purge. It does not cover the bounded `BATCH=400` loop of `loescheAbfrage` in `src/server/trustAndSafety.ts`.

## New synthetic boundary test
In `tests/accountErasure.spec.ts`, an additional `it.runIf` case runs only with explicitly available local Firestore **and** Storage emulators and a nonproduction runtime/project guard. It creates exactly **401** registry records for one synthetic UID, **one** unrelated owner's registry record, a user profile, and a pending deletion job. The setup and cleanup contain 404 writes each, below the 500-write Firestore batch ceiling.

It exercises the real `purgeAccountData(uid, requestId)` cleanup query: the first 400 owned records require a full deletion batch, and the remaining 1 must be deleted by the next query pass. It then asserts that no owned code remains, the user's profile is removed, the foreign reservation is unchanged and the same purge can be run again idempotently. Test fixtures have unique synthetic codes, no real user data, and deterministic cleanup in a `finally` block.

### Mandatory exact-head acceptance
1. CI job must complete/succeed on this branch's immutable source SHA; **do not transfer parent #224's PASS**.
2. Original test log must **explicitly show** `deletes 401 owned registry reservations across the 400-document batch boundary` with a PASS mark, **not skip**. Check the total `accountErasure.spec.ts` count increased from 4 to 5.
3. Typecheck, Enterprise Security/Privacy gates, Firestore/Storage emulator, all other pure and integration tests, build, browser acceptance and no failed job steps must be verified.
4. If Firestore emulator cannot support the test or it times out, keep it unapproved and diagnose source effects without invoking the real database.

### Remaining release blockers
This test verifies a *single invocation* crossing a 400-document collection batch, **not** a mid-batch process crash, durable lease handoff, retry under rate limiting, retention/legal hold or a >400-record mutation with a time-slice interruption. Registry issuance/claim remain **unconnected** to production routes and the legacy referral inventory has no approved source-wide read/backfill. Age, Didit, consent, qualifying rewards, anti-abuse, Art. 17 provider erasure and staging/production IAM are separate approval gates.

No real Firestore account reads, production collection creation, user rewards, merge, deployment, manual workflow trigger, `main` commit or PR #119/RC R2 changes. Independent Product/DPO/Legal/Security/SRE/Release Owner signoffs missing. **PRODUCTION BLOCKED / NO-GO.**
