# ADR — PR #119 Bun/npm supply-chain audit gate contract (2026-10-23)

**Decision status: Proposed; formal Security and Release Owner approval REQUIRED.**
**Release status: NO-GO / HARD STOP. No automatic gate replacement or CI trigger.**
**Source baseline:** PR #119 `7fdf29010c85f16a9b38e5c93186f32e92192f3a`, tree `05f22f0ca387ae37573b1f81e85ead901dce3da9`.

## Context and recorded evidence
The app in `phase2_work/` is Bun-only (`bun@1.4.2`, `bun.lock`). `phase2_work/scripts/check-dependency-locks.mjs` explicitly rejects an app `package-lock.json`. The Functions graph instead uses `phase2_work/functions/package-lock.json`. The required Gate 07 remains `npm audit --audit-level=high`, a command which by default requires npm's lockfile. npm 10.9.2 in a *separate offline fixture* with no npm lockfile returned `ENOLOCK`, exit 1. This demonstrates a contract issue, not an application vulnerability verdict or an authorized-host gate result.

Gates 08–09 invoke unpinned `npx gitleaks` and `npx semgrep`; neither is an application package dependency in `phase2_work/package.json`. The audit host must have authenticated/pinned scanner binaries without allowing a surprise network acquisition.

## Proposed resolution — not authorized and not yet implemented
- Retain a deterministic and comprehensive vulnerability gate for **both** dependency graphs: independently assess `bun audit --audit-level=high` against the application's committed `bun.lock` (verify availability and behavior on Bun 1.4.2), and `npm audit --audit-level=high` in the Functions package directory against its committed npm lockfile. Store distinct logs, exit codes, manifest hashes and coverage notes.
- Do **not** silently label this as an existing Gate 07 PASS. Release Owner/Security must amend and version the authoritative 15-gate contract, review the scanner and dependency-coverage semantics, and explicitly accept any new gate IDs/commands.
- Use vetted offline-installed versions for Gitleaks and Semgrep, with pinned executables/digests and approved rules/config. Reconcile the exact mandatory command text and record any policy update; `npx` alone does not attest trusted provenance.
- Do not remediate by committing an app `package-lock.json`, ignoring ENOLOCK, using `--no-package-lock`, changing `npm audit` failure codes, or disabling SCA.

## Verification and release boundaries
This ADR is based on GitHub's immutable tree and static source review, official npm/Bun docs and the offline npm control experiment. It was **not** validated on the required host (Node v22.23.3/Bun 1.4.2/Docker) and no real SCA network advisory assessment occurred. Remaining release status: **0/15 qualified mandatory gates PASS, 0/4 independent sign-offs; NO-GO**.

No application code, schema, dependency lock, CI workflow, PR #119, main or production change. Rollback: revert this ADR and associated audit-only status/runbook entry on the isolated audit branch.
