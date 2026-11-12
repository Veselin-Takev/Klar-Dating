# RC Manifest — Klar v0.1.1-rc1

**Phase:** A / PROPOSED RELEASE SCOPE  
**Status:** BLOCKED — P0 containment code/test changes present in RC branch; mandatory verification and independent proof outstanding  
**Date:** 2026-11-08  
**Target tag (proposed, NOT created):** `v0.1.1-rc1`  
**Branch:** `release/v0.1.1-rc1`  
**Immutable base:** `main@96c3857c53f5ced31fe1394895185f42c75bc716`  
**Product version at base:** `package.json: 0.1.0` (historical project label `v149` is a separate identifier; reconcile before tagging)  
**Risk:** HIGH / P0, destructive-data and GDPR Art. 17 boundaries  
**Production approval:** `false`; **NO-GO**. This manifest is not a release approval.

## Goal, bounded scope and source candidates

Prepare ONE reviewable, test-first **fail-closed containment batch** for unproven verification-photo deletion safety across two real paths:
1. Signed verification-photo purge scheduler/route must remain **hard-disabled in real production**, including valid HMAC, explicit bucket and feature flag. Physical deletion must not resume before independently proven Firestore/GCS all-writer fencing.
2. Art. 17 account-erasure flow must never bypass the purge restriction through `functions/src/retention.ts`; production must not silently claim completion when verification-photo removal is legally/technically pending.
3. Reject ambiguous or malformed Firestore `legalHold`/`photoPurgeHold` and GCS `temporaryHold`/`eventBasedHold`/generation data; maintain explicit bucket/project identity and generation-precondition safety. **No automatic "safe-to-delete" interpretation of missing provenance or a cross-service race.**
4. Document unresolved legal exceptions, audit, recovery and cross-service proof obligations separately; do not misrepresent containment as complete lawful erasure.

**Issue/ticket scope:** VES-5 (P0 photo purge), VES-15 (Art. 17 account-erasure storage path), related P0 #202.  
**Existing PR source candidates (NOT pre-approved or blindly merged):** #345 (bucket), #348 (scheduled purge hard-stop), #349 (account-erasure hard-stop), #350 (Firestore hold guard), #352 (GCS metadata checks), #353 (combined review candidate). Review ancestor dependencies including #317 and all actual GCS/Firestore writers. Source-candidate exact CI successes are NOT an RC integrated-SHA PASS.

**Excluded from this RC:** active photo-deletion re-enable; VES-14 canary/promotion (#347/#354), VES-11 age-gate (#337/#346/#351), VES-12 Firebase Admin project identity (#343/#344), mobile DOB UX (#338), dependency pin #315/#316, broad multi-tenant redesign. Those require separate, named RC batches and compatibility review.

## Affected runtime modules, tests and data contracts

- `phase2_work/src/server/routes/complianceStorage.ts`: signed destructive purge endpoint, configuration and decision/hold gates.
- `phase2_work/functions/src/retention.ts`: account-erasure profile/verification Storage deletion boundary.
- Review `phase2_work/src/server/trustAndSafety.ts` and actual callers as well as Firebase Storage Rules, Didit/Admin and Cloud Scheduler writers, before asserting all entrypoints fenced.
- `phase2_work/tests/complianceStoragePurge.spec.ts`, `tests/verificationPurgeHttpEmulator.spec.ts`, `tests/accountErasure.spec.ts`, `tests/photoRetention.spec.ts`, `tests/storageRules.spec.ts` and `scripts/deletion-storage-check.mjs`.
- `phase2_work/scripts/check-compliance-storage-purge.mjs` and cron/security static regression checks.
- Firestore `verification_events`: decision, `legalHold`, `photoPurgeHold`, purge intent/proof and owner/path references; GCS bucket, object generation and object hold metadata.
- **Migration policy:** No production schema migration or backfill approved. Read-only inventory and explicit DPO-reviewed handling for legacy/malformed records required. Any future schema migration must be separately scripted, reversible where possible and reviewed before RC promotion.

## Breaking changes / risk assessment

- **HIGH:** Destructive purge route intentionally responds HTTP 503 in production while cross-service deletion remains unproven.
- **HIGH:** Account erasure may remain pending or return an explicit fencing error when verification-photo objects exist. Persist and expose accurate pending/audit state rather than reporting completed erasure.
- **HIGH:** Legitimate cleanup can be delayed, triggering GDPR Art.17/retention obligations; DPO/legal owner must define temporary exception and incident/resolution procedure.
- **MEDIUM:** Fail-closed handling of unexpected metadata may block operations on legacy objects. Require negative tests and safe reconciliation.
- **HIGH:** A green branch-local CI, GitHub mergeability, storage-generation precondition or Firestore-only transaction cannot prove late-hold safety at the real GCS deletion boundary.

## Phase B: TDD and code fusion — IN PROGRESS (unverified RC changes)

1. **Started test-first:** the new `tests/verificationPhotoContainment.spec.ts` contract was committed before runtime changes. Existing `photoRetention`, Storage Emulator, account-erasure and dependency-free storage checks were updated for fail-closed containment. Test execution on final SHA remains required. Write/strengthen additional real Firestore/Storage staging adversarial cases before enabling deletion. Cover no cloud calls, stale permits, late holds, rejected decision, partial/pending account erasure, unknown metadata, missing bucket/project identity, crashes, retries and unexpected cloud environment markers.
2. **Scope reviewed:** `#353` is 159 commits ahead of `main`, spanning 35 changed files. No blind branch/history merge was performed. Narrow runtime changes in the RC branch hard-disable the signed purge route and legacy age-worker, while account erasure refuses verification-photo deletions and only permits bounded profile-photo cleanup with strict hold/generation checks. A complete external/cloud writer inventory remains OPEN.
3. **Narrow code implemented in RC (not validated):** `src/server/routes/complianceStorage.ts`, `functions/src/retention.ts` and `functions/src/deleteExpiredPhotos.ts` deny destructive verification operations. No production mocks, no activation flag or bypass path introduced. This is containment, not full distributed fencing.
4. Continue documentation and report synchronization; `phase2_work/CHANGELOG.md`, scoped ADR and this RC manifest are updated on the release branch with Conventional Commits. Root readiness and cross-service source/evidence registers must remain consistent before sign-off.
5. No force push to protected branches, no blind merges, no enabling production deletion, no production IAM/Storage/Cloud Run mutation.

## Phase C: mandatory gates — all UNVERIFIED on RC head

Run in `phase2_work/` on the final integrated immutable SHA and record exact command, environment, complete logs, timestamps, job/run and result:

| Required gate | Current result |
|---|---|
| `npm run typecheck` — zero TS errors | NOT RUN |
| `npm run test:pure` | NOT RUN |
| `npm run test:rules` — native Firestore emulator | NOT RUN |
| Full changed-feature Unit/Integration + Firestore/Storage rules/emulator suites | NOT RUN |
| `npx playwright test` — causal E2E, security and error paths | NOT RUN |
| `npm audit --audit-level=high` | NOT RUN |
| `npx gitleaks detect` — pinned and reproducible toolchain; no exposed secrets | NOT RUN |
| `npm run build` | NOT RUN |
| Project-specific `npm run check:enterprise`, Functions build, retention/Art.17 gates, dependency and release-provenance checks | NOT RUN |
| Independent AppSec/DPO/SRE review and isolated cloud adversarial staging evidence | NOT VERIFIED |

A gate with missing executables, unsupported npm lock/audit metadata, uninstalled browsers/emulators or skipped tests is **BLOCKED/NOT VERIFIED**, never PASS. Respect Node.js 22.23.3, Bun 1.4.2 and the repository's canonical dependency locks; do not change dependency management just to get a superficial PASS. Do not waive a failure without explicit approved risk acceptance; for this P0 batch no release exception is pre-approved.

## Phase D: sign-off / promotion — STOP

**RC state:** `BLOCKED`. No RC tag, merge to main, promotion to staging or production, activation of destructive cleanup, or approval from this document. Final report must include target tag, integrated SHA, all test counts, artifact hashes, changelog/ADR/migration status, review sign-offs, unresolved risks and exact CI evidence.

**Decision rule:** Only a fully integrated, immutable-SHA RC with ALL mandatory gates and independently evidenced release controls can be `READY FOR PROMOTION`. A completed report must STOP and request a separate explicit **PROMOTE** instruction before any merge or staging promotion. Production traffic still requires the independent protected production GO process.

**Follow-on RC suggestions (not yet created):** VES-14 protected release promotion; VES-12 identity/bucket isolation; VES-11 backend age-gate and mobile a11y; dependency/provenance alignment. Each must have its own scope manifest and RC cycle.
