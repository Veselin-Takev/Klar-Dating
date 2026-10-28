# Partner consent status / account deletion privacy boundary (Issue #56)

Date: 2026-10-28. Base main SHA: `2808dc1cbb485f70b403681c108cea5a3361d950`. **DRAFT / PRODUCTION NO-GO**.

## Verified defect

The private `GET /partner/consent` path called `getPartnerConsentState`, which read only `users/{uid}`. If the user had previously granted partner tracking and `account_deletions/{uid}` existed, the endpoint still returned `allowed:true`, misleading the client about current eligibility. This differed from the transaction-guarded consent mutation and partner link issuance paths.

## Correction

`getPartnerConsentState` reads both the user and deletion-marker documents inside one read-only Firestore transaction. A deletion marker yields `{allowed:false}` and never resurrects consent; incomplete reads and backend errors fail closed. Active consenting users without a deletion marker still get the original valid state. Regression tests cover existing deletion marker, ordinary active grant, and Firestore failure. The HTTP route already applies private/no-store headers and translates unexpected errors into 503.

## Verification limits and release gates

These tests are in-memory Firestore doubles; they do not prove emulator serializability or actual concurrent deletion writes. Run `npm run test:launch` as relevant, `vitest run tests/partnerReferralService.spec.ts`, and exact-HEAD Enterprise CI. Existing PR #184 protects partner link listing independently and should be reviewed before integration to avoid missing a dependency. Formal DPO/Security/SRE signoffs, retention inventory, live deletion cascade tests and business partner legal terms are still required. No main merge or production deploy. **PRODUCTION NO-GO**.

## Firestore emulator verification added — 2026-10-28

Enterprise CI `40773758879` passed for the original PR HEAD `397ceb6ecf433221dc64f26aabfc4be6acbb1d87`. Added `tests/partnerConsentStatusDeletionEmulator.spec.ts`, exercising the **real Firestore emulator** for both an existing deletion marker and a consent state that changes from granted to denied when a deletion marker is created. The tests ensure the read does not rewrite the stored grant. A strict guard validates localhost-only configured emulator port and demo-project identity and rejects production runtime and durable-store fallback before any Firestore connection; test documents have random IDs and cleanup. An ordinary unit test without the emulator will skip the integration suite, not prove its success. The fresh exact-HEAD Enterprise CI and independent live Art.17, DPO, Security and Operations evidence remain mandatory. **Production NO-GO.**
