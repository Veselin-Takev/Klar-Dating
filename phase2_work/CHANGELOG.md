# Changelog

## [Unreleased — v0.1.1-rc1 / Phase A] — 2026-11-08

### Proposed (not implemented)
- Define the scoped enterprise release-candidate workflow for VES-5 and VES-15: verification-photo physical-delete hard-stop and account-erasure containment until cross-service Firestore/GCS safety is independently proven.
- Record exact base SHA, P0 risk, source PR dependencies, test-first implementation and mandatory release gates in `docs/releases/v0.1.1-rc1/RC_MANIFEST.md`.
- Document proposed safety decision, rejected alternatives and GDPR Art.17 operational tradeoffs in `docs/adr/ADR-2026-11-08-RC-P0-PHOTO-DELETION-CONTAINMENT.md`.

### Verification / release state
- **BLOCKED / NO-GO**: This entry documents planning only. No runtime code has been integrated, no RC gate executed on a final integrated SHA, no schema migration performed, no RC tag created, and no deployment or production change authorized.
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
