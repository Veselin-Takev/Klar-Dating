# Klar Remediation Checkpoint – 28 October 2026 (Audit v2: A-01 / A-08 / A-14)

**Base:** main `2808dc1cbb485f70b403681c108cea5a3361d950`  
**Scope:** isolated review candidate; **Production NO-GO**; no finding closed by this source-only change.

## Exact proposed changes
- **A-01:** Retain deployed scheduler symbol `deleteExpiredPhotosCron` but restrict it to bounded `funnel_events` cleanup. Its old GCS creation-age sweep and Storage page-token checkpoint are disconnected. The legacy helper `deleteExpiredPhotoPage` now unconditionally rejects every call (`AGE_ONLY_PHOTO_PURGE_DISABLED`). Explicit Art.17 account erasure stays available.
- **A-08:** `DATA_RETENTION.md` points to the signed decision-bound purge and consistently states 20 documented TTL collection groups, with the LEGAL/DPO/live ACTIVE confirmation still pending.
- **A-14:** Bind a 2 KiB path-specific raw parser ahead of global JSON parsing, reject missing raw body instead of HMAC-signing `{}`, and calculate HMAC from original body Buffer bytes, without lossy UTF-8 conversion.
- Existing `check-compliance-storage-purge.mjs` source gate validates parser ordering and byte-exact signature code. `check-retention-config.mjs` now enforces disabled age-only execution rather than requiring the unsafe scheduler.
- Updated unit test fixtures cover binary HMAC proof and reject the legacy age-only entry point.

## Required verification / acceptance (NOT COMPLETED)
1. On isolated exact-head checkout: Node.js 22.23.3, Bun 1.4.4, frozen locks, git diff consistency; TypeScript, Functions build, unit suites, source security checks, SAST/SCA, Firebase emulators, HTTP tests, Playwright and build must pass.
2. Real HTTP negative tests: canonical signed `{}` accepted; altered bytes, missing raw buffer/wrong media type, stale timestamp, over-2KiB, invalid signature rejected. Verify global /api limiter remains effective.
3. Verify old Function scheduled name has no `verification/` Storage delete side effects; explicit account-erasure behavior remains unaffected.
4. **A-06/A-15 still open:** decision-bound purge lacks immutable GCS generation precondition and durable cursor with reconciliation; no production GCS deletion until these controls and races are independently verified.
5. **A-02/#70:** Staging ACTIVE state of all 20 approved TTL collection groups, source inventory, legal holds and independent DPO/Legal/Ops review still outstanding.
6. **A-04/#8:** 14 SHA-bound mandatory gates, 13 integration artifacts and independent Security/Privacy/Legal/SRE/Release approval are still outstanding. `RELEASE_MANIFEST.json` remains NO-GO.

**Governance:** Commit is proposed on an isolated review branch only; existing PRs including audit-locked #119, production deploy, cloud IAM, and main branch are not modified. This document and a source checker PASS cannot attest to actual Firebase emulator/Cloud/production controls. No GO, no automatic closure.
