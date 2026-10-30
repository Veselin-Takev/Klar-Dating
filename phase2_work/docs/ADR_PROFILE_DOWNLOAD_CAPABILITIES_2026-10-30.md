# ADR — Profile media capability URLs: telemetry/referrer containment and blocked migration

Date: 2026-10-30
Status: **PARTIAL MITIGATION IN DRAFT / P1 #206 OPEN / PRODUCTION NO-GO**
Stacked on draft PR #205 (adult access), itself stacked on draft PR #203 (biometric photo retention).

## Verified threat boundary

`src/lib/klar.ts::ladeProfilfotoHoch` uploads to Firebase Storage, calls `getDownloadURL()`, stores the returned URL in the user's Firestore `photoURL` and returns it to the UI. `src/screens/Profile.tsx` renders a direct image `src`, and other app components render profile photo links. Firebase describes these as *long-lived revocable download URLs*; a copied URL is a capability, not an authenticated viewer authorization check. Firebase advises direct `getBlob/getBytes` for finer-grained Storage Rules enforcement (https://firebase.google.com/docs/storage/web/download-files). Thus the approved adult/active Security Rules in draft #205 are **not sufficient to revoke access granted through an earlier bearer URL**.

Separate, source-confirmed data leakage: `src/lib/api.ts::monitoredFetch` passed the entire `RequestInfo.toString()` (including potentially `?token=`) into debug logs and error diagnostics. Even in development, this is unsafe. The active server uses `helmet()`; an unused secondary header module has its own policy. Both boundaries now use `no-referrer`.

## This limited patch

1. Legacy `monitoredFetch` preserves inputs, responses and the original rejected error for its callers, but emits **no URL/path/query** and sends a new generic error to the diagnostics facility. Server-owned metrics remain responsible for P95/P99.
2. Effective `helmet({ referrerPolicy: { policy: 'no-referrer' } })` and auxiliary security header agree on no-referrer. This reduces outbound referrer disclosure; it does **not** prevent anyone in possession of an image URL from reading it.
3. A static `check:profile-token-telemetry` in Enterprise CI and Vitest canary tests assert no credential-bearing URL appears in slow-request or error diagnostics and that the referrer policy is configured. **Exact-HEAD CI pending; this document does not claim PASS.**

## Remaining binding acceptance criteria

The only durable solution for profile media revocation is an approved architecture migration from `getDownloadURL` to an **authenticated, short-lived and viewer-authorized image delivery path** (SDK `getBlob/getBytes` plus CORS, or an authenticated server media proxy). Migrate user profile photo references and all UI/API consumers, handle legacy links, revoke/rotate issued Firebase download tokens, control signed URLs and CDN/browser caches, and test access after age/account/block transitions. Source-level URL suppression and no-referrer are partial exposure reductions **only**.

Live deployed Storage Rules and Cloud IAM remain unverified. Default-Firestore `firestore.get` cross-service permissions, age-status migration, privacy legal basis, staged token revocation/rollback and independent Security, DPO/Legal, SRE, Finance, Product and Release Owner approval remain mandatory. **Production NO-GO.**
