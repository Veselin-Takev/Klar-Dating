# VES-5 / VES-15 — Consolidated verification-photo deletion review candidate

**2026-11-08 · Integration Draft only · NO-GO · productionApproved=false**

## Branch provenance

This review branch is based on **Draft #349** (exact base SHA `ca97df699cc9b0bdca59add95cfe452293d7c141`), which in turn depends on the scheduled verification-purge production hard-stop **Draft #348**. The safety logic was combined *at source level* with the reviewed Firestore/GCS record-hold and metadata validation work in **Draft #350** and the account-erasure metadata work in **Draft #352**.

It was deliberately based on #349 to **preserve** the stronger safety invariant that regular account erasure is **profile-only**, refusing to delete under `verification/{uid}/` or claim complete erasure when such objects are present. The old dual-prefix delete is only available through the explicitly named `unsafe-emulator-test-only` mode and is denied with `NODE_ENV=production`. The signed retention endpoint remains blocked in production even when a signed HMAC, feature opt-in and bucket name are present. This branch does **not** enable any production deletion or change the cloud configuration.

## Source-level integration changes

- The signed verification-photo purge now checks Firestore record-level `photoPurgeHold` and `legalHold` on **every** existing eligibility transaction; only absent or exact boolean false values pass. Unexpected present values (including strings, null and objects) fail closed. **A hold arriving *after* the final authorization still races with GCS** without the missing all-writer fence.
- The same route also fails closed on malformed `temporaryHold` or `eventBasedHold` provider metadata before GCS generation-conditional deletion. A present hold field other than literal false blocks deletion.
- The account-erasure Storage helper preserves #349's production-default hard stop for unfenced verification objects, and additionally rejects malformed provider object-hold metadata and missing, non-decimal, negative or unsafe numeric generations **for its profile-only deletions**.
- Static retention and compliance gates now require strict GCS hold predicates **without removing** #349's mandatory `verification_storage_purge_p0_fencing_unverified` 503 gate. The legacy scanner test was updated to the stronger hold predicate.
- Unit and signed Firestore Emulator regressions check the Firestore hold fields before intent creation and **after persisted intent but before final pre-delete authorization**. Real account-erasure helper tests check profile-only default and no false completion for existing/late verification photos; extra negatives reject malformed profile-object holds/generations without calling delete.

## Additional boundary: mandatory pre-delete authorizer

A targeted review found that `deleteVerificationStorageFile` was exported with an **optional** `beforeDelete` callback. A future direct caller could therefore reach generation-conditional GCS deletion without invoking the final Firestore/lease eligibility check, even though the current signed route supplies that callback. This allowed accidental bypass of the route's pre-delete check by other imports.

This review requires the callback in the **TypeScript function signature**, rejects absent/non-function callbacks **at runtime before Storage metadata access**, and always calls it immediately before `file.delete({ifGenerationMatch})`. A negative unit test uses an untyped `Reflect.apply` call to omit the callback and verifies that neither `getMetadata` nor `delete` runs. Existing unit tests now supply explicit synthetic authorizers; the signed production route continues supplying its real Firestore transaction. Mandatory static checks protect the contract against regressions.

**Strict limitation:** A callback's existence does not establish the callback's authority. A synthetic no-op callback is used *only* in isolated unit tests. An external writer could still bypass the helper entirely, and a Legal Hold arriving **after** a successfully executed authorization callback can race the GCS operation. This patch is a defense against a direct-helper omission, **not** a solution to VES-5 all-writer fencing or a production GO.

## Test-only destructive override: explicit local opt-in (2026-11-08)

A further source review discovered that the account-photo helper's `unsafe-emulator-test-only` selector previously rejected only `NODE_ENV='production'`. A Cloud Run/Functions/Vercel deployment with an **unset** or non-production `NODE_ENV` could therefore reach the legacy dual-prefix verification-photo delete path if a future caller supplied the otherwise test-named mode. The existing ordinary account-erasure caller did **not** do this; this is a preventive code-boundary finding rather than an observed live destructive action.

The runtime now denies that mode **before any Storage API read**, except when all conditions are present simultaneously: `NODE_ENV='test'`, `KLAR_TEST_VERIFICATION_DELETE='allow'`, `FIREBASE_STORAGE_EMULATOR_HOST` explicitly pointing at `127.0.0.1`, `localhost` or `[::1]` on a port, and absence of Cloud Run (`K_SERVICE`), Cloud Functions (`FUNCTION_TARGET`) and Vercel (`VERCEL_ENV`) runtime markers. The new opt-in flag has no production path; it is not a way to enable the signed retention purge. This is defense in depth, **not an authorization system for real verification photos**.

The mandatory real-module `scripts/deletion-storage-check.mjs` now scopes the local override environment to each isolated test and restores prior variables. New negative test cases attempt missing, development and production `NODE_ENV`; missing/bogus opt-in; missing or non-loopback Storage emulator hosts; and each named cloud-runtime marker, all requiring zero `getFiles()` or `delete()` calls. A positive in-memory emulator fixture remains executable only with every explicit local condition. The actual `tests/storageRules.spec.ts` Storage Emulator fixture explicitly opts in within a `try/finally` and restores the environment.

**Remaining limitation:** Node environment variables alone are not a cryptographic proof that a bucket is an emulator; therefore the test-only override must never be used with cloud credentials or real data. The ultimate solution is to remove or isolate the legacy dual-prefix helper entirely after the P0 test migration, and to implement independently reviewed all-writer fencing rather than activate it in production. `productionApproved=false`, **NO-GO**.

## Explicitly not proven

1. **Post-authorization cross-service race:** If a moderator/legal authority revokes consent or sets a hold in Firestore *after* the last Firestore transaction, an in-flight GCS delete can still occur in isolated test-only paths. A GCS generation match is not a Firestore write fence. Fix requires a reviewed monotonic all-writer protocol, including external console/Admin SDK and bucket writers, and adversarial real staging tests that prove the late hold prevents irreversible deletion.
2. **Incomplete Art. 17 fulfillment:** The profile-only hard stop defers the durable account-deletion job when unfenced verification photos exist. This is safer than falsely reporting erasure, but it requires a DPO-reviewed legal-hold/erasure exception, transparent status, monitoring and deadlines; no legal compliance conclusion is made.
3. **Integration/cross-branch gaps:** CI on independent Draft #349/#350/#352 is only a source-specific proof; this branch needs its own final exact-SHA Enterprise CI, retained emulator evidence and independent AppSec/DPO/SRE/Release Owner signoff. Different Firebase project identities, GCS bucket provenance and IAM must be integrated with #343/#344/#345.
4. **Scope:** No Cloud Scheduler, service account, Storage IAM, billing, live objects or production configuration was inspected or modified in this branch.

## Acceptance before any release

- [ ] Exact HEAD SHA and **completed** `check:enterprise`, `check:functions`, Typecheck, `test:ci`, `test:production` and Playwright CI with signed Firestore Emulator and no missing required steps.
- [ ] Adversarial late Firestore hold/revocation **after** final authorization and **before** GCS Delete: assert no unauthorized deletion at *both* destructive paths.
- [ ] All-writer inventory with independent GCP IAM/Cloud Console/TTL/Scheduler inspection; tenant and bucket isolation.
- [ ] Art. 17 and lawful preservation policy with DPO signoff and durable pending/exception/receipt semantics.
- [ ] Independent AppSec/SRE/Release Owner approval, reviewed merge order, final combined SHA and `productionApproved=true` issued only through governance process, not this branch.

**Release: NO-GO. Production purge flag must remain OFF. No merges to main, production GCS deletes, IAM or billing changes.**

Related: [VES-5](https://linear.app/takev/issue/VES-5), [VES-15](https://linear.app/takev/issue/VES-15), [#349](https://github.com/Veselin-Takev/Klar-Dating/pull/349), [#350](https://github.com/Veselin-Takev/Klar-Dating/pull/350), [#352](https://github.com/Veselin-Takev/Klar-Dating/pull/352), [release register #341](https://github.com/Veselin-Takev/Klar-Dating/pull/341).