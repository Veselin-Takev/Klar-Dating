# Production Readiness

## Completed in this package

- Server Firestore access migrated to Firebase Admin/ADC; no hard-coded server password.
- Audit-log encryption no longer has a built-in fallback secret.
- Cloud Run-compatible `PORT` handling.
- Public client Firebase configuration restored from the complete project configuration.
- Secret scan added as a CI gate.
- GitHub Actions CI/release workflows consolidated into explicit gates.
- GitLab CI pipeline added with the same core gates.
- Production Dockerfile and health check added.
- Playwright is configured to start the emulator-backed app for E2E runs.
- Generated test/build reports and historical patch scripts are excluded from the production source package.

## Required external controls

These cannot be safely fabricated inside a source archive and must be configured in the target platform:

- Real production secrets in a secret manager / protected CI variables.
- Firebase production IAM / Workload Identity.
- Protected `main` and release tags.
- Staging environment and production approval gate.
- Monitoring/alerting and incident response ownership.
- Backup/restore verification for Firestore and Storage.
- A tested rollback target (previous immutable image digest).

## Validation note

This archive was prepared and statically checked in the available execution environment. The environment only provides Node.js 22.16.0 and has no usable npm registry/network access, so a fresh `npm ci`, full TypeScript/Vitest/Playwright run, Firebase emulator run and production build could not be honestly marked as executed here.

The repository therefore **must not be represented as fully test-certified until the supplied CI pipeline completes green on Node.js 22.23.3**. The CI workflow is intentionally configured to make that verification mandatory before a release tag is promoted.


## v149 verification status — 2026-10-07

The v149 hardening pass restored the validated enterprise v146 security/compliance baseline while retaining the v149 UI/UX changes. Static P0 gates are green, including authentication, public Firestore rules, UID-scoped storage, AI PII sanitization, distributed rate limiting, mail lease recovery, Art. 17 deletion audit, BGB cancellation flow, production-data, CSP, contrast, hooks and route inventory.

The release remains **BLOCKED (Non-Prod)** because this runner cannot install Node 22.23.3 or the dependency graph, and therefore cannot provide trustworthy TypeScript/Vitest/Playwright/build/emulator evidence. Protected release identity, SBOM, OCI attestations, staging deployment and production approval are also unavailable here.

## End-to-end audit delta — 2026-10-07

The 2026-10-07 enterprise audit found and corrected the following release-integrity issues:

- GitHub Playwright workflow step structure was invalid; Node/Bun setup steps are now valid YAML and independently parseable.
- GitLab CI Node baseline was aligned to Node 22.23.3.
- Root dependency policy is now internally consistent: Bun 1.4.2 + `bun.lock`; the conflicting root `package-lock.json` was removed. Firebase Functions retain their dedicated npm lockfile.
- `check:enterprise` now declares all referenced Didit/KYC reconciliation gates.
- ESLint 9 Flat Config is now present as `eslint.config.mjs`; the legacy `.eslintrc.json` was removed.
- Firebase Functions explicitly declare `packageManager: npm@10.9.2`.
- The unused legacy `src/server/translation.ts` was removed. Production translation remains exclusively behind the sanitized `translationEngine` and bounded translation service.
- A dedicated `check:legacy-translation-boundary` gate is part of `check:enterprise`.

Static security/privacy/feature boundaries remain PASS. Full dynamic production certification remains blocked in this execution environment because the project dependency tree, Firebase CLI and Playwright browser/toolchain are not installed locally and registry access is unavailable.


## Autonomous remediation — 2026-10-08 (CI gate #1)

- GitHub repository access and PR #1 are now verified against the authoritative private repository.
- First dynamic CI run (run #12) reached the enterprise static gates after successful Bun/npm dependency installation on Node.js 22.23.3.
- The first blocking finding was the fail-closed deletion-cascade catalog: `legal_acknowledgements` and `legal_updates` were detected without explicit decisions.
- Remediation: `legal_acknowledgements` is explicitly classified as user-scoped and deleted with account data; `legal_updates` is explicitly classified as system-wide legal publication data that does not belong to account deletion.
- Follow-up hardening: the deletion cascade now explicitly purges `users/{uid}/legal_acknowledgements` before deleting the user document, so the static catalog and runtime deletion path are aligned without relying on implicit recursive cleanup.
- Production status remains **NO-GO** until the complete dynamic CI/test/build/smoke/browser evidence is green and all external production controls are verified.


## 2026-10-08 — Autonomous CI remediation

- Enterprise static gates: all checks through dependency/toolchain/release gates passed in CI run #16 before the IPv6 regression gate.
- Remaining blocker: the first IPv6 regression detector produced false positives because its source-expression matcher was too broad.
- Remediation: the gate was tightened to validate the actual keyGenerator expression and require explicit ipKeyGenerator(req.ip ...) normalization whenever req.ip is used.
- Production status: **NO-GO** until a subsequent CI run proves the corrected gate, followed by typecheck, tests, build, production smoke, browser acceptance, and release provenance evidence.
