# P0 #254 — Storage Emulator: effective cross-tenant profile visibility and biometric denial

**Date:** 2026-11-01. **Scope:** Read/write only synthetic objects in the `demo-klar` local Firebase Storage Emulator; source-only Draft branch based on unmerged [PR #285](https://github.com/Veselin-Takev/Klar-Dating/pull/285) SHA `170a0586b22aed47a37c8d82e6cf6843896c6c32`. Parent exact-head full [CI #41342756886](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/41342756886) completed **SUCCESS**. **Decision: P0 #254 and #202 OPEN / Production BLOCKED-NO-GO.**

## Evidence gap

Source-only Storage Rules marker inventory showed checked-in `profiles/{uid}/{datei}` is readable by any `signedIn()` client, while `verification/{uid}/{datei}` is explicitly client-read-denied. This is a **hypothesis about effective permissions** until exercised against actual Firebase Storage Rules and the local emulator. A signed-in profile-image reader may intentionally be allowed regardless of tenant for product discovery; no legal approval of that policy has been recorded. A profile-image read permitted to a client with a *different synthetic `tenantId` claim* is a **policy characterization**, not proof of an exploit or inappropriate disclosure.

## Source-only emulator remediation

Adds two native Storage Emulator regression cases to the existing mandatory `tests/storageRules.spec.ts` (already included in `test:ci`, which boots `firebase emulators:exec --project demo-klar --only auth,firestore,storage`):

1. **Cross-tenant profile read:** synthetic owner with `tenantId:'tenant-a'` uploads a JPEG at `profiles/{ownerUid}/tenant-cross-read.jpg`; an unrelated signed-in viewer with `tenantId:'tenant-b'` is expected to **succeed** at Storage `getMetadata()`, faithfully documenting the currently checked-in `allow read: if signedIn()` behavior. The same unrelated viewer is forbidden from overwriting the owner's object; unauthenticated metadata access fails. It is **not** marked tenant-safe.
2. **Biometric denial:** synthetic owner uploads a JPEG at `verification/{ownerUid}/tenant-isolation.jpg`; both owner and different-tenant viewer **fail** Storage metadata reads, different-tenant overwrite fails and owner client delete fails.

The tests use real Firebase Storage rules evaluation, not string matching; synthetic unique object paths are cleaned up via Admin SDK against the emulator **only**. The test suite's existing emulator-only execution remains mandatory; no live Firebase/GCS objects, user credentials, project IAM or Security Rules were modified. The tests should never silently invert an intentional current-policy expected-success into a denial without reviewed product/DPO policy, tenant-aware rules, and signed migration.

## Release blockers

- These local tests are **not actual deployed Storage Rules**, live IAM, real Auth token claim distribution, global tenant membership verification or a complete BOLA/IDOR suite. Backend Admin SDK bypasses client Rules. Native Storage Emulator tests cannot prove legal approval of cross-tenant profile image visibility.
- Tenant #254 needs approved *purpose-specific* profile visibility policy, tenant routing/claims authority, Firestore+Storage client and Admin SDK cross-tenant negatives, actual deployed Rules/tenant data migration and independent DPO/AppSec/Legal/SRE review.
- P0 #202 still needs authenticated GCS generation/hold/404/412 physical-delete receipts and crash replay, >300 durable workload and audited production Scheduler/IAM cutover.
- **Only an exact-head full combined CI PASS** plus verification that both native Storage tests were actually executed (not skipped) constitutes source test evidence. Neither an older parent PASS nor lexical rule markers authorize release.

**All PRs remain Draft/unmerged; `productionApproved=false`; no production deploy or data mutation.**
