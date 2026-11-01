# P0 #254 — Storage Rule Source Risk Markers (Review-Only)

**Date:** 2026-11-01. **Base:** Draft #282 head `5c82c3c2f7847a63eef09a863e194106cfba96d9`, full CI #41339344795 SUCCESS. **Status:** Source-only Draft; P0 #254 and #202 OPEN / Production BLOCKED-NO-GO.

## Source-backed concern

Checked-in `storage.rules` contains `match /profiles/{uid}/{datei}` with `allow read: if signedIn();`, and flat `match /verification/{uid}/{datei}` uploads. In a planned multi-tenant application, a read authorized solely by authentication requires explicit product/privacy analysis: it is **not tenant-scoped**. These facts are **not proof** of a deployed rule, cross-tenant exploit or an unacceptable public-profile design. The existing biometric `allow read: if false` is preserved unchanged.

## Change

A new deterministic, **read-only** `check:storage-tenant-risk` produces SHA-256 of local `storage.rules` and source line numbers for flat profiles, biometric verification, authenticated-only profile reads, update/create, and tenant namespaces. It explicitly returns `reviewRequired=true`, `tenantIsolationCertified=false` and `livePermissionVerified=false` for the current checked-in source. No rule contents, user data or tokens are emitted. Node negative tests verify immutable source digest and lack of misleading certification; the mandatory enterprise/dual-P0 gate makes the review difficult to omit silently. No Security Rules or Cloud resources are changed.

## Required before GO

Independent product/Legal/DPO classification of profile image visibility; Auth/Firestore/Storage Emulator tests for cross-tenant users and account-deleted users; authenticated origin, storage metadata and tenant ownership checks; source-to-deployed-rule hash equivalence; Admin SDK backend authorization (Admin bypasses client rules); migration and rollback plan; AppSec/SRE signed evidence. Retention #202 still requires a durable queue, checked decision/holds, generation-fenced GCS operations and receipts. **No merge, deployment or production approval.**
