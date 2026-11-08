# Release Candidate Report — Klar v0.1.1-rc1

**Checkpoint:** Phase A complete; Phase B containment integrated **within this RC branch**, verification in progress.  
**Status:** **BLOCKED** / STOP / NO-GO  
**Date:** 2026-11-08  
**Target tag:** `v0.1.1-rc1` — NOT CREATED  
**Branch:** `release/v0.1.1-rc1`  
**Base:** `main@96c3857c53f5ced31fe1394895185f42c75bc716`  
**Draft PR:** [#355](https://github.com/Veselin-Takev/Klar-Dating/pull/355)  
**Approval:** `productionApproved=false`; NO-GO; no main/release manifest mutation.

## Scope — test-first P0 containment only

VES-5/VES-15: both the signed retention Scheduler route and Art.17 account-erasure Storage helper must not physically delete unfenced verification photos. The legacy upload-age cron is explicitly disabled for photo deletion; unrelated funnel-event TTL continues. Profile-only account-photo cleanup remains bounded by owner path and GCS generation/hold checks; verification objects before or after profile cleanup block deletion completion.

**Applied on RC branch (NOT production):**
- `src/server/routes/complianceStorage.ts`: authenticated request cannot bypass HTTP 503 and cannot read Firestore/Storage.
- `functions/src/retention.ts`: legacy age worker always rejects; account erasure requires absence of verification objects and validates held/malformed profile metadata.
- `functions/src/deleteExpiredPhotos.ts`: no age-based photo deletion from scheduled function.
- Negative `tests/verificationPhotoContainment.spec.ts` added **before** runtime implementation; other `tests/photoRetention.spec.ts`, `tests/storageRules.spec.ts`, `tests/accountErasure.spec.ts`, `scripts/deletion-storage-check.mjs`, static compliance and retention checks aligned with this contract.

This RC does **not** activate storage purge, implement a global distributed all-writer fence, authorize cloud configuration changes or guarantee legal erasure deadlines. Source-candidate PRs #345/#348/#349/#350/#352/#353 informed the scoped decision, but their 159-commit ancestor chain was **not** bulk-merged.

## Mandatory Verification Gates — final SHA required

| Required check | Current result | Rule |
|---|---|---|
| `npm run typecheck` | NOT YET VERIFIED ON FINAL RC SHA | Zero TypeScript errors |
| `npm run test:pure` | NOT YET VERIFIED ON FINAL RC SHA | 100% pass |
| `npm run test:rules` | NOT YET VERIFIED ON FINAL RC SHA | Firebase native rules/emulator pass |
| Full changed-feature Unit / Firestore / Storage Emulator integration | NOT YET VERIFIED ON FINAL RC SHA | No silently skipped cases |
| `npx playwright test` | NOT YET VERIFIED ON FINAL RC SHA | E2E causal tests pass |
| `npm audit --audit-level=high` | NOT RUN / BLOCKED | Zero high/critical vulnerabilities; verify canonical Bun lock policy before claiming npm-audit coverage |
| `npx gitleaks detect` | NOT RUN / BLOCKED | Zero leaks, tool/version/provenance documented |
| `npm run build` | NOT YET VERIFIED ON FINAL RC SHA | Clean app + Functions build |
| Project enterprise/static/Art.17/retention/release provenance gates | NOT YET VERIFIED ON FINAL RC SHA | All required checks pass |
| Independent AppSec, DPO, SRE and Release Owner, cloud staging | NOT VERIFIED | External writer/IAM inventory, adversarial late-hold race proof and rollback/recovery |

**Never transpose a green source PR check or historical intermediate-commit CI to a final RC PASS.** For final SHA: record Actions run/job IDs, exact test counts and accepted artifacts. An absent, skipped, cancelled, red or in-progress check is **not PASS**.

## Open release blockers

1. **HIGH P0:** All-writer Firestore/GCS linearizable deletion protocol not implemented/proven, including a legal hold or photo write after final preflight; no production photo-purge activation.
2. **HIGH P0:** DPO-approved Art.17 pending/deletion exceptions, retention backlog ownership, reconciliation, customer handling and credible recovery plan are absent.
3. **HIGH:** Real Firebase/GCS/IAM/Cloud Scheduler/tenant project/bucket evidence and independent review are missing.
4. **HIGH:** Exact final RC security audit commands (`npm audit`, `npx gitleaks detect`) and full final mandatory gate evidence are incomplete.

## Artifacts and documentation

- Manifest: **YES**, `docs/releases/v0.1.1-rc1/RC_MANIFEST.md`
- ADR: **YES (proposed; external sign-off pending)**, `docs/adr/ADR-2026-11-08-RC-P0-PHOTO-DELETION-CONTAINMENT.md`
- `phase2_work/CHANGELOG.md`: **YES (Unreleased RC entry)**
- Schema migrations: **NONE**; no backfill, new schema or external data mutation
- RC tag / merge / staging promotion / production change: **NONE**

## Decision

**BLOCKED / STOP**. No `PROMOTE` requested. Complete exact-final-SHA verification, independent appsec/DPO/SRE release sign-off and cloud safety proof first. Even a fully green local/CI run remains NO-GO for production until the separate protected production approval process confirms readiness.
