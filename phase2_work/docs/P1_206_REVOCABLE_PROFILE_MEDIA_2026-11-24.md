# P1 #206 — Revocable profile media read boundary (2026-11-24)

## Scope and immutable base

- Repository: `Veselin-Takev/Klar-Dating`.
- Exact base: `main@2043811c584c41232fd85509b7a6b36083f6f69c`; tree `3cb2d220f13d5e1a6c1ac49f2b9831e727b65435`.
- This change is a code-and-hermetic-test remediation only. It does not claim that previously issued Firebase/GCS bearer links have been revoked.
- No real profile data, UID, token, signed URL, download URL, credential, or cloud project was accessed or emitted.

## Static source inventory on the exact base

| Surface | Current source / behavior | P1 #206 disposition |
|---|---|---|
| Upload writer | `src/lib/klar.ts::ladeProfilfotoHoch` writes owner-scoped `profiles/{uid}/...` objects and persists `klar-media:v1:` in `users/{uid}.photoURL`; it does not mint a Firebase download URL. | Preserve canonical opaque reference writer. |
| Reference contract | `src/lib/profileMediaRef.ts` and `src/server/platform/profileMedia.ts` encode/decode owner-scoped paths and reject traversal/cross-owner references. | Preserve canonical ref; raw object paths are accepted only as transitional owner-scoped aliases on the authenticated server path. |
| Server read | `src/server/platform/profileMedia.ts::createProfileMediaRouter` mounts `/api/profile-media/self` and `/api/profile-media/:uid/:mediaRef`; Firebase ID token is verified with revocation checking; requester and target lifecycle/adult/deletion state and both block directions are checked before Storage access. | Keep per-request authorization and fail closed; self target is derived from verified token. |
| API projection | `src/server/platform/launchPlatform.ts` uses `normalizeProfileMedia` to emit only a first-party authenticated proxy route, not a raw storage URL. | Legacy URL aliases must resolve to no media, not be republished. |
| Client reader | `src/lib/profileMediaClient.ts` uses `authFetch`, rejects non-canonical public targets, validates MIME type, and creates temporary object URLs; it aborts/revokes on target, viewer or unmount changes. | Keep viewer/session binding and object-URL lifecycle. |
| UI consumers | `AuthenticatedProfileImage` is used by profile, discovery/recommendation cards, chat, dashboard and widgets; it renders the authenticated client abstraction rather than direct Storage URLs. | Preserve placeholder/error rendering and localized alt/copy behavior. |
| Caches/referrers | Proxy uses private/no-store response policy; app Helmet config applies `no-referrer`; client object URLs are temporary. | This change makes no-store, no-cache, no-referrer and Authorization variance explicit at the media route. |
| Telemetry/logs | `profileTokenTelemetryPrivacy.spec.ts` covers generic sanitized failure diagnostics; proxy failure handling does not log request URL, bearer header, object path or SDK exception text. | Keep raw URL/token data out of diagnostics and logs. |
| Storage/erasure | Active Storage Rules deny direct client reads; Art. 17 and retention controls are separate Admin-SDK boundaries. | No Rules, IAM, deletion, retention or erasure logic is changed. |

## Contract tightened by this PR

1. Canonical `klar-media:v1:` references remain the durable profile media identifier.
2. All media bytes are delivered only by the same-origin authenticated proxy; Firebase ID token verification checks revocation on each request.
3. Requester and target must have explicit adult, active, non-suspended, non-blocked and non-deletion-pending states; account-deletion markers deny; either-direction block denies public viewing.
4. Target media references must decode to an owner-scoped `profiles/{targetUid}/...` path. Malformed, cross-owner, traversal and URL-shaped legacy bearer aliases fail closed before Storage reads.
5. A legacy Firebase/GCS download URL is never converted back into a path, even if the query token is absent or malformed. No URL-shaped value is serialized to public projections.
6. Media responses are `private, no-store, max-age=0`, `Pragma: no-cache`, `Expires: 0`, `Referrer-Policy: no-referrer`, `Vary: Authorization`, and `X-Content-Type-Options: nosniff`.
7. The browser exposes only temporary blob URLs and revokes them on source/session change and unmount. Failure continues to use existing placeholder/offline/localization behavior.

## Hermetic regression proof added

- Reject Firebase and GCS token URLs, URL-shaped aliases without tokens, and malformed URL aliases.
- Verify canonical self-view still streams through the authenticated proxy.
- Verify legacy self-view bearer URLs return not-found and do not invoke Storage.
- Verify requester/target adult, active, suspension, block, deletion-pending and account-deletion checks; both block directions remain denial conditions.
- Verify no-store, no-cache, no-referrer and Authorization variance headers.
- Existing client tests continue to cover anonymous denial, authFetch use, MIME checks, abort/session changes and temporary object-URL revocation; existing UI tests retain placeholder behavior.
- Tests use synthetic fixture values only. No emulator or live service is required for this PR's proof.

## Migration, rollback and operational separation

- This PR does not run an inventory against live Firestore/Storage, alter object metadata, change `firebaseStorageDownloadTokens`, rewrite profile documents, delete/copy/rename objects, alter bucket ACL/IAM, deploy, or contact a Firebase/GCP project.
- Previously copied bearer URLs may remain usable until a separately authorized, bounded inventory and token-revocation operation is completed. Hermetic tests cannot prove revocation of already-issued URLs.
- Migration/rollout remains a distinct operational change: first obtain an approved staging project/bucket identity, read-only aggregate inventory, reviewed cohort and digest-bound plan; then obtain explicit separate approval for staging metadata mutation, validate object generations/metagenerations and compare-and-set, and independently verify post-state. Production requires its own explicit release authorization and is not implied by this PR.
- Rollback is code-only: revert the proxy/alias behavior through a reviewed follow-up while retaining direct Storage reads denied. Do not restore public bearer URLs, loosen Storage Rules, or bypass Art. 17 retention/erasure guards.
- Stop/rollback if an unauthorized viewer receives bytes, malformed state reaches Storage, stale cache serves media after access revocation, or any diagnostic contains bearer material. Keep the route fail-closed and preserve the existing Storage/Auth and erasure boundaries.

## Status

- Draft PR targets `main`; do not merge until exact-head CI, independent AppSec/DPO review, and separately approved operational migration evidence are complete.
- This PR's own Klar Enterprise CI and Enterprise Compliance & Security Audit Gate run IDs/conclusions: **[TO VERIFY]** (Anti-SHA-Chasing; do not create a recursive docs-only commit to chase run IDs).
- `productionApproved=false`; production **NO-GO**. P0 #47, #48, #55, #56, #70, #202, #254, #371, #373 and #374 remain **OPEN**.
