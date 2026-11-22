# P0 #254 Package 4 — Tenant Firestore & Storage Rules Contract

**Baseline:** `main@c20dca0d11595f91b8a86687038ea86ba89aa453` (Tree `711a47cc6fb56e0f77f1ff4d73a9b014aa782970`; PR #401 merged).  
**Status:** Isolated candidate contract; this is not an active Firebase Rules deployment.  
**Release invariant:** P0 #254 remains **OPEN**; `productionApproved=false`; production **NO-GO**.

## Purpose and isolation boundary

Package 4 defines a deny-by-default candidate Rules contract for tenant-native Firestore profile/chat reads and tenant-native Storage profile-media writes. Candidate files are deliberately separate from active `firestore.rules`, `storage.rules` and `firebase.json`. Only `firebase.tenant-candidate.json` references them, and that configuration is used by a dedicated local emulator test command.

No production route, client SDK path, Admin SDK path, IAM binding, live project, bucket, deployment or active Rules configuration is changed. Passing emulator tests demonstrates only the candidate contract under the synthetic fixtures in this document.

## Membership and data model

- Tenant claim authority is the signed Firebase Auth custom claim `tenantId`; the path tenant must exactly match it.
- Active membership is read from the server-managed document `tenants/{tenantId}/members/{uid}`, whose `tenantId`, `uid` and `active == true` fields must match the authenticated identity.
- Membership documents are not client-readable or client-writable under this candidate Rules file.
- Profile owner authority is the document path UID matching `request.auth.uid`.
- Chat participant authority is the server-managed `participantUids` list on `tenants/{tenantId}/chats/{chatId}`; the authenticated UID must be present.
- No role, including `admin` or `super_admin`, bypasses the membership, tenant, owner or participant checks.

## Candidate Firestore policy

| Tenant-native path | Candidate permission |
|---|---|
| `tenants/{tenantId}/profiles/{uid}` | Authenticated, non-anonymous owner with matching signed tenant claim and active membership may `get`; collection listing is denied |
| `tenants/{tenantId}/chats/{chatId}` | Authenticated, non-anonymous verified participant with matching tenant claim and active membership may `get`; listing is denied |
| `tenants/{tenantId}/members/{uid}` | Client read/write denied; server-managed authority only |
| Profile/chat create, update, delete | Denied to clients |
| Every undefined path/operation | Deny by default |

Explicit legacy-root denials cover `users`, `public_profiles`, `profiles`, `verification`, `verification_events`, `connections`, `blocks`, `chats`, `subscriptions`, `refund_queue`, `contacts` and `account_deletions`. The recursive catch-all denies every unlisted path and operation.

## Candidate Storage policy

Only `tenants/{tenantId}/profiles/{uid}/...` is eligible for client writes. Create/update require a matching signed tenant claim, active server-managed membership, `request.auth.uid == uid`, a non-empty file no larger than 5 MiB, and content type `image/jpeg`, `image/png` or `image/webp`. Delete is permitted only for that same authorized owner; it has no new request resource to validate. Cloud Storage Rules expose a unified `write` operation covering create/update/delete, so the candidate distinguishes delete by `request.resource == null`.

All direct client reads, including owner reads, remain denied to preserve the Media-Proxy boundary. Legacy `users`, `profiles`, `verification` and `verification_events` paths and all undefined object paths are denied. Admin roles do not bypass the policy.

## Local emulator contract

The dedicated emulator config is `firebase.tenant-candidate.json`:
- Firestore: `127.0.0.1:8189`
- Storage: `127.0.0.1:9298`
- Hub: `127.0.0.1:4518`
- Logging: `127.0.0.1:4618`
- Project: `demo-klar` only

Run from `phase2_work/`:

```bash
npm run test:tenant-rules-contract
```

The test harness refuses to initialize without both emulator endpoint environment variables. It loads the two candidate Rules files directly and uses synthetic IDs only. The Firebase client SDK in this test file connects only to the emulator endpoints supplied by `firebase emulators:exec`; the test does not contain credentials or a live-project fallback.

## Nine required negative/boundary groups

1. Authentication: unauthenticated, anonymous, missing tenant claim and malformed tenant claim are denied.
2. Membership: missing, inactive and contradictory tenant/UID membership records are denied.
3. Tenant boundaries: cross-tenant document paths and incorrect signed tenant claims are denied.
4. Same-tenant IDOR: a valid member can read only their own profile, not another member's profile.
5. Chat authorization: a listed participant can read; an active tenant member absent from the server-written participant list cannot.
6. Privilege boundary: `admin` and `super_admin` cannot bypass owner or participant restrictions.
7. Storage: authorized owner upload/delete is permitted; foreign UID, foreign tenant, invalid MIME, oversized upload and all direct reads are denied.
8. Legacy paths: Firestore and Storage legacy path families are denied.
9. Default deny: undefined paths, collection listing and non-permitted client profile/chat writes are denied.

## Explicit exclusions / non-activation

- No changes to active `firestore.rules`, `phase2_work/firestore.rules`, `storage.rules`, `phase2_work/storage.rules` or existing `firebase.json`.
- Candidate Rules are not swapped into or activated through any existing Firebase configuration.
- No changes to `tenantContext.ts`, `tenantRepository.ts`, `legacyTenantMapping.ts`, `server.ts`, existing production routes or the `complianceStorage.ts` 503 interlock.
- No changes to `.github/workflows/`, dependencies or lockfiles.
- No real UIDs, email addresses, KYC data or other real PII in fixtures.
- No Firebase/Cloud SDK deployment, live/staging connection, migration, IAM/bucket mutation or production cutover.
- No change to `productionApproved=false`.

## Evidence lifecycle

The immutable Package 3 main baseline is supported by Klar Enterprise CI Run [#45063508643](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/45063508643) and Enterprise Compliance & Security Audit Gate Run [#45063508612](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/45063508612), both successful on exact `main@c20dca0d11595f91b8a86687038ea86ba89aa453`. Package 4's own exact-HEAD CI and Audit runs are **[TO VERIFY]** until observed. Preserve previous PR #401 / #400 / #399 and earlier SHA-specific records as immutable history.
