# Changelog

## [Unreleased — v0.1.1-rc1 / Phase A] — 2026-11-08

### Proposed (not implemented)
- Define the scoped enterprise release-candidate workflow for VES-5 and VES-15: verification-photo physical-delete hard-stop and account-erasure containment until cross-service Firestore/GCS safety is independently proven.
- Record exact base SHA, P0 risk, source PR dependencies, test-first implementation and mandatory release gates in `docs/releases/v0.1.1-rc1/RC_MANIFEST.md`.
- Document proposed safety decision, rejected alternatives and GDPR Art.17 operational tradeoffs in `docs/adr/ADR-2026-11-08-RC-P0-PHOTO-DELETION-CONTAINMENT.md`.

### Implemented in RC branch (awaiting full verification)
- Test-first security regressions for the signed verification-photo purge endpoint, legacy upload-age deletion, and account-erasure Storage path.
- Deny the signed purge route with HTTP 503 after HMAC verification without opening Firestore or Cloud Storage, regardless of feature flags.
- Disable the legacy upload-age photo-delete worker; keep its independent expired funnel-event cleanup.
- Refuse account erasure when verification photos are still present; bound ordinary profile-only cleanup with strict GCS generation and hold validation and a second verification-object check.
- Update existing Vitest, real Storage Emulator, Art.17 storage script and static retention guards to assert intentional containment rather than physical verification-photo deletion.
- All changes are restricted to `release/v0.1.1-rc1`; no part of the 159-commit upstream dependency chain was bulk merged.

### Verification / release state
- **BLOCKED / NO-GO**: P0 containment code and tests are present in this RC branch, but a complete mandatory gate run on the final integrated SHA, independent cross-service staging race proof, cloud IAM inventory and approvals remain outstanding. No schema migration, RC tag, deployment or production change authorized.
- Existing upstream PR CI success is historical source evidence, not a verification result for this RC.

## [Release-Prep / Phase 2 Setup] — 2026-10-08

### Added
- Phase-2 solution design with C4 context/container/component views, data flows, RAG boundary and security boundaries.
- AI governance RACI, risk classes, autonomy levels and mandatory Human-in-the-Loop thresholds.
- Configurable AI budget and rate-limit policy in `config/ai-budget.json`.
- Deterministic provider-bound PII sanitizer in `src/security/piiSanitizer.ts`.
- Input/output guardrail middleware for prompt injection, control-tag, toxicity and selected compliance patterns.
- Agent RBAC action policy with tenant scoping and high-risk human approval enforcement.
- Tenant/workflow token-cost tracker and budget hard/soft-cap controls.
- Versioned deterministic prompt registry with response schema.
- Central Phase-2 agent orchestrator with fail-closed guardrails and Human-in-the-Loop fallback.
- Unit tests for PII sanitization, RBAC, budget controls, cost tracking and orchestration.

### Changed
- `README.md` now documents the Phase-2 AI architecture, control-plane boundaries and verification posture.
- `ARCHITECTURE.md` now contains the current enterprise AI architecture and security boundaries.
- `tsconfig.json` enables JSON module resolution for versioned prompt registry artifacts.

### Verification posture
- Static source-level verification is performed after implementation.
- Full dependency-backed TypeScript, unit, emulator/E2E and production-build verification remains dependent on the available runner toolchain and installed dependency graph.
- No production deployment or promotion is performed by this Phase-2 setup.
