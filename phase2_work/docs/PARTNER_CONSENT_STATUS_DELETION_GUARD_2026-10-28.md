# Partner consent status / account deletion privacy boundary (Issue #56)

Date: 2026-10-28. Base main SHA: `2808dc1cbb485f70b403681c108cea5a3361d950`. **DRAFT / PRODUCTION NO-GO**.

## Verified defect

The private `GET /partner/consent` path called `getPartnerConsentState`, which read only `users/{uid}`. If the user had previously granted partner tracking and `account_deletions/{uid}` existed, the endpoint still returned `allowed:true`, misleading the client about current eligibility. This differed from the transaction-guarded consent mutation and partner link issuance paths.

## Correction

`getPartnerConsentState` reads both the user and deletion-marker documents inside one read-only Firestore transaction. A deletion marker yields `{allowed:false}` and never resurrects consent; incomplete reads and backend errors fail closed. Active consenting users without a deletion marker still get the original valid state. Regression tests cover existing deletion marker, ordinary active grant, and Firestore failure. The HTTP route already applies private/no-store headers and translates unexpected errors into 503.

## Verification limits and release gates

These tests are in-memory Firestore doubles; they do not prove emulator serializability or actual concurrent deletion writes. Run `npm run test:launch` as relevant, `vitest run tests/partnerReferralService.spec.ts`, and exact-HEAD Enterprise CI. Existing PR #184 protects partner link listing independently and should be reviewed before integration to avoid missing a dependency. Formal DPO/Security/SRE signoffs, retention inventory, live deletion cascade tests and business partner legal terms are still required. No main merge or production deploy. **PRODUCTION NO-GO**.
