# Klar v149 — Security Hardening 2026-10-08

## Scope

Three security-critical work packages were hardened against the current v149 baseline:

1. Prompt security and LLM guardrails.
2. Firestore RBAC and append-only audit controls.
3. Deterministic versus stochastic compliance-test separation.

## 1. Prompt security

All provider-bound Gemini requests now pass through `src/server/aiBudget.ts` and the central `src/server/platform/aiPromptSecurity.ts` boundary.

Controls:

- system instructions and untrusted data are structurally separated with XML delimiters;
- XML control tags are escaped/redacted before provider egress;
- common indirect prompt-injection patterns are detected and neutralized;
- every Gemini request requires `responseMimeType=application/json` and a `responseSchema`;
- model output is bounded and checked for prompt/control-tag leakage;
- JSON output is validated against the declared provider schema before it is accepted;
- existing PII sanitization and AI budget reservation remain upstream of provider execution;
- the old direct `GeminiCacheService` provider bypass was removed.

## 2. Firestore RBAC / audit

- privileged Firestore reads use Firebase Auth custom claims (`role` / `roles`), never user-profile role fields;
- `audit_logs` is client-readable only for privileged custom claims and is client append/update/delete denied;
- server audit writes use `appendAuditLog()` and `DocumentReference.create()` only;
- audit records contain a keyed HMAC pseudonym instead of raw UID;
- consent audit records are pseudonymous at creation time and are append-only;
- user and block writes received from clients are schema/field constrained in Security Rules;
- Art. 17 erasure remains a documented exception for historical legacy records that still contain direct identifiers.

## 3. Test separation

Deterministic tests remain independent of live LLM behavior and use pure logic, mocks, and Firebase Emulator suites.

The stochastic LLM-as-a-Judge evaluation is isolated behind:

- `scripts/evaluate-llm-security.mjs`
- `npm run eval:llm-security`
- `.github/workflows/llm-evaluation.yml` (`workflow_dispatch` only)

The stochastic evaluation requires an explicit HTTPS evaluation endpoint and never participates in `test:pure`, `test:rules`, or the deterministic Enterprise CI gate.

## Verification

Static security gates pass in the current runner. The dynamic TypeScript/Vitest/Firebase/Playwright/Vite gates remain environment-blocked because the supplied runner has no installed project dependencies/CLI cache and registry access is unavailable.
