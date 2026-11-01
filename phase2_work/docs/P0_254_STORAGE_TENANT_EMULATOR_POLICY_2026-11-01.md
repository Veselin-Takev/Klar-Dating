# P0 #254 — Native Storage Emulator Cross-Tenant Profile/Biometric Policy Evidence

**Date:** 2026-11-01 · **Branch:** `security/p0-254-storage-tenant-emulator-negatives-20261101`  
**Parent:** [Draft #285](https://github.com/Veselin-Takev/Klar-Dating/pull/285), exact SHA `170a0586b22aed47a37c8d82e6cf6843896c6c32`, [CI #41342756886](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/41342756886) **SUCCESS**.  
**Decision:** Both P0 #254 and #202 OPEN. **Production BLOCKED / NO-GO**. No checked-in Firebase Rules changed.

## What is actually under test

The existing `tests/storageRules.spec.ts` already runs against the native **Firebase Storage Emulator**, using the checked-in `storage.rules` and a synthetic `demo-klar` project, under the standard `test:ci` pipeline (`firebase emulators:exec --project demo-klar --only auth,firestore,storage`). The existing tests showed verification-photo client-read denial and UID-scoped upload authorization but did **not** exercise Storage requests with explicitly different `tenantId` token claims.

This stacked Draft adds two live emulator scenarios with fresh synthetic objects and distinct `tenant-A` and `tenant-B` mock claims:

1. **Profile read — currently permitted across tenants:** A `tenant-A` UID uploads its own synthetic profile object. A different signed-in `tenant-B` UID **can read its metadata** because the current checked-in rule authorizes profile reads by `signedIn()`, without comparing tenant claims. An unauthenticated read, foreign upload and foreign delete are all denied. The test intentionally asserts existing **observed rule behavior** rather than claiming that cross-tenant visibility is lawful or safe. DPO/Product must decide whether profile images are intentionally discoverable across tenants and what restrictions/consents are required.
2. **Verification photo — read-denied for both tenants:** A synthetic `tenant-A` UID uploads its own verification image. Client metadata reads by both owner and `tenant-B`, a download URL request from `tenant-B`, its upload overwrite and deletion are denied. The test-only fixture is cleaned up by the existing emulator-configured Admin SDK, because client deletes are intentionally blocked.

Both tests enforce a loopback Storage Emulator host and demo project before any test writes; they use UUID-derived fixture paths and no real personal or biometric photographs. Tests are never production-ready evidence for **deployed** rules or backend Admin SDK authorization. Because these tests use the current, *broad-profile-read* policy, tightening profile visibility later requires an independently approved policy and a deliberate, reviewed update of the expected result.

## CI changes

New `check:storage-tenant-emulator-coverage` asserts the two native tests and the emulator-only Vitest/CLI wiring remain present, and new Node mutation tests reject removal of the tenant-A/B fixture, metadata allow/deny checks, local emulator guard or Storage emulator from `test:ci`. This is a static **coverage guard**, not proof that tests actually executed. It is included alongside the existing `check:tenant-inventory`, `check:tenant-rules-surfaces`, `check:storage-tenant-risk` and all Retention gates in `check:enterprise`; `check:dual-p0-integration` also rejects its removal.

**Full exact-head CI and direct log evidence of the two native Storage scenarios are mandatory** before attributing PASS to this Draft. Prior #285 CI PASS does not transfer to changed code.

## Remaining production blockers

- Actual deployed Firebase Rules and their Firebase project/bucket identity, authorized tenant ownership/ACL and all app-visible profile-media retrieval pathways.
- Independent DPO/Legal/Product approval of cross-tenant discoverability, verification/consent state and age restrictions; negative tests for same-tenant BOLA, JWT-claim mismatch, deleted accounts and downloads via cached URLs.
- Backend Admin SDK bypass of Storage Rules and tenant/UID/challenge mapping; an emulator rule test does not validate server-side least privilege.
- P0 #202 durable retention job producer/consumer, legal holds and generation-bound deletion receipts, 404/412 ambiguity resolution, >300 backlog throughput and staging/GCS operation evidence.
- Signed AppSec/DPO/Legal/SRE/Release Owner reviews on a final merged artifact SHA. No deployment/merge, real data query, Storage/Firestore production mutation, IAM or Scheduler modification authorized.

**P0 #254 and #202 remain OPEN. Release manifest stays `productionApproved=false`; Production NO-GO.**
