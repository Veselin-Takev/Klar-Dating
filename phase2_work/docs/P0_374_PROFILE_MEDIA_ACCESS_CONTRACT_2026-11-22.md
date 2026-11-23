# P0 #374 — Profile Media Access Contract (Package 1)

**Date:** 2026-11-22  
**Status:** Draft engineering contract; default OFF; not mounted; no production approval.  
**Baseline:** `main@8c239dd71bbeb1bfdd5373cfbe763ab2c9e5a406` (Tree `5c17337773b86d0c09baff9615921e673750117b`).  
**Issue:** [P0 #374](https://github.com/Veselin-Takev/Klar-Dating/issues/374) remains OPEN.

## Security objective

Replace implicit trust in long-lived Firebase download-token URLs with a server-authorized media-delivery boundary. This package adds only an injectable TypeScript contract and synthetic tests. It does not connect to Firebase, Cloud Storage, Firestore, a network endpoint, or a production route.

## Six-phase architecture

1. **Server-authorized delivery boundary.** A future server route must call this contract only after an explicitly reviewed integration change. The contract is deliberately not imported or mounted by `server.ts`; this package alone creates no endpoint.
2. **Fail-closed requester and target authorization.** Require an authenticated non-guest requester, verified adult status, and current consent. Resolve target state and both block directions from authoritative server-side policy. Reject missing, deleted, deactivated, or non-adult/unverified target profiles. Missing or unavailable authority fails closed. Roles such as `admin` and `super_admin` never bypass these checks.
3. **Opaque object paths.** Accept only canonical `profile-media/v1/<opaque-id>` paths. Never accept a raw URL, Firebase download-token URL, UID-derived legacy path, traversal, encoded separator, or client-selected host. A future migration to opaque object keys is a separate, explicitly approved workstream.
4. **Short-lived signed URL.** Verify object existence through an injected storage adapter, then ask an injected signer for an HTTPS URL on an explicit hostname allow-list. The request TTL must be an integer from 1 through 300 seconds; returned expiry must be in the future and cannot exceed the requested TTL (with no expiry tolerance beyond the requested TTL).
5. **Revocation and cache controls.** Every successful response carries `Cache-Control: no-store, max-age=0`, `Pragma: no-cache`, and `Expires: 0`. Revocation design must account for URL expiry, object-key rotation, block/deletion state, CDN/browser caches, and access-log minimization. A signed URL is a bearer capability until expiry; short TTL is not instantaneous revocation.
6. **Independent approval before cutover.** Before any live token revocation, object migration, Storage Rules change, or route activation, require exact-head CI, an inventory and rollback plan, independent AppSec review, DPO/Legal approval of retention and deletion behavior, and SRE review of availability, rate limits, cache behavior, observability, and rollback. Each operational action requires separate explicit authorization.

## Contract invariants

- Only server-owned `serverConfig?.enabled === true` enables execution. Otherwise return 503 before authentication, policy, storage, or signer calls.
- Guest/unauthenticated requests return 401. Requester age/verification or consent failures return 403.
- Target absence or deleted/deactivated state returns 404; target adult/verification failure and either-direction blocks return 403.
- No URL is issued until authentication, requester checks, target policy, block checks, and object-existence verification pass.
- Signer output must be HTTPS, have no embedded credentials, use an allow-listed hostname, and have a valid bounded expiry.
- Policy/storage/signer exceptions fail closed. No role-based bypass exists.
- The module has no Firebase imports, no direct network/storage client, and no route/bootstrap integration.

## Offline adversarial test matrix

Synthetic tests cover default-off zero downstream calls; absent identity; guest; underage and unverified requester; missing consent; both block directions; incomplete target/block policy; missing/deleted/deactivated target; unverified/non-adult target; persistent Firebase token URL; traversal and encoded traversal; legacy UID path; zero/negative/fractional/over-ceiling TTL; expired and excessive signer expiry; signer-returned persistent token URL; untrusted signer host; mandatory no-store headers; valid adult access; and `admin`/`super_admin` non-bypass.

## Explicit non-goals and operational exclusions

No production route or `server.ts` change; no active Firestore/Storage Rules, `firebase.json`, or `complianceStorage.ts` change; no live migration, token revocation, Cloud/IAM/Firestore/Storage/bucket/deployment mutation; no real PII/UID; no workflow, dependency, or lockfile change. `productionApproved=false` and production NO-GO remain hard invariants. P0 #374 and P0 #254 remain OPEN.
