# P0 #254 — Native Storage Rules Tenant-Claim Evidence

**Date:** 2026-11-01. **Branch:** `security/p0-254-native-tenant-storage-negative-evidence-20261101`.  
**Parent:** unmerged [Draft #283](https://github.com/Veselin-Takev/Klar-Dating/pull/283), SHA `d2d77d700bcdf8cfd54b943a244f6faafb7590b8`. Its six native Firestore tenant Rules scenarios and six native retention tests passed in [CI #41341786655](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/41341786655); final CI completion must be checked independently.  
**Release:** P0 #254 and #202 **OPEN**, production **BLOCKED / NO-GO**.

## Source-backed scope gap

Checked-in `storage.rules` contains `match /profiles/{uid}/{datei}` with `allow read: if signedIn()`. Any signed-in user can retrieve an existing legacy profile image, irrespective of the claimed tenantId and profile UID. This may be the intended **public profile media** behavior of the current dating application, but it is **not an enforceable tenant boundary** for a future multi-tenant product. In contrast, legacy verification `verification/{uid}/{datei}` read is denied to all clients, including owners. No `tenants/{tenantId}/...` storage allow rules exist yet; tenant-prefixed object access remains default-denied and therefore not functionally cut over. These are source-level observations, not evidence that a customer photo has leaked.

## Source-only, synthetic Emulator evidence

The new `tests/tenantStorageBoundary.emulator.spec.ts` invokes actual Firebase **Storage Rules Emulator** with explicit `demo-klar` project ID and loopback `FIREBASE_STORAGE_EMULATOR_HOST`. Synthetic random UIDs and JPEG payloads are created only inside the emulator. Four tests should demonstrate:

1. Owner upload allowed under legacy `profiles/{uid}`, and the photo URL is still readable to another authenticated identity claiming **a different tenant**; an anonymous user is rejected.
2. The cross-tenant outsider cannot overwrite or delete the owner's profile photo despite being able to read it under the current signed-in public-media policy.
3. A synthetic biometric verification photo, seeded by the emulator-only Admin Storage SDK, is **unreadable** to both its owner and an account with a different tenantId; owner client deletion also denied.
4. A synthetic object under `tenants/tenant-alpha/profiles/{uid}` is inaccessible even to a legitimate mocked same-tenant owner, documenting that the future Storage namespace **has not been deployed/authorized yet**. No new read/write access is introduced by this PR.

The new `check:tenant-native-storage` and its Node mutation tests require the storage suite, loopback Emulator, source rule file and four essential scenarios, while `check:dual-p0-integration` forbids silent removal of this check. The existing Firestore native tenant suite, six retention Emulator tests and all P0 source gates remain intact.

## Limits and release blockers

- Emulator Auth tenant claims are mocked; this is not real token issuance, tenant membership verification, IAM review, Admin SDK tenancy segregation or production rule deployment evidence.
- No restrictions were added to `profiles/{uid}` reads, because changing current app-wide photo visibility without product/legal/tenant migration approval could break intended functionality. An explicit **approved media visibility contract** and tenant-specific Storage rules must be designed and reviewed before cutover.
- Admin test setup and cleanup operate only when `FIREBASE_STORAGE_EMULATOR_HOST` points to loopback and the project is `demo-klar`. No real Cloud Storage, customer biometrics, scheduler, account deletion, IAM or TTL mutation.
- Real Storage path ownership, global UID/challenge/object mapping, downloaded URL/token invalidation, Auth/Storage cross-tenant BOLA/IDOR, GCS 404/412/replacement and crash-receipt staging, Art.-17 deletion cascade, durable >300 Retention queue, clock and hold evidence, DPO/AppSec/Legal/SRE/Release Owner signoffs remain absent.
- Require **exact-head full CI**, four native Storage tests **actually executed** alongside the prior six native Tenant Firestore Rules and six native Retention Firestore tests; test-source and deployed-rule hashes must be matched at authorized staging, then final SHA reviewed.

**No merge, deployment, production customer-data access or production GO. `productionApproved=false`.**
