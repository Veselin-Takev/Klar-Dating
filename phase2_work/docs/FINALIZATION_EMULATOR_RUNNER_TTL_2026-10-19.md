# Klar Finalization: Firestore Emulator / GitHub CI runner / TTL (2026-10-19)

**Decision: NO-GO.** Current development review is **not** an official production approval. Feature branch only; no main merge, production data operations, gcloud TTL writes or GitHub Actions rerun.

## Evidence and source-basis correction

The attached earlier Enterprise Implementation PDF states that all mandatory gates and all P0 blockers passed, but simultaneously notes the absence of real Firestore Emulator tests and includes illustrative unimplemented cascading-subcollection code. These narrative claims are **not executable acceptance evidence**. This report instead uses GitHub exact-commit source, local subprocess exits and GitHub Actions job metadata. The external researcher report is guidance only, not a signed Security/DPO/SRE release attestation.

## Targeted changes and results

| Scope | Confirmed finding | Verified remediation / honest limitation |
| --- | --- | --- |
| P0 Firestore Rules test isolation | Hard-coded port preflight missed the configured test ports 8085/4405/4505 | `check-emulator-ports.mjs` reads the approved profile and blocks duplicate, wrong, occupied or unknown profile ports; eight offline tests PASS under Node 22.23.3 |
| P0 Art.17 Emulator integration | Production code has a dedicated four-scenario Vitest suite, but actual execution was not evidenced | A real local Google Firestore Emulator v1.20.2 was launched on 127.0.0.1:8085 under Temurin Java 21 with actual rules; the isolated sandbox crashed **before any rules/transaction assertions**. Real integration verdict = **BLOCKED**, not PASS |
| P0 TTL #70 | 20 group matrix, before-write preflight, dry-run guard and evidence validators exist | `npm run check:retention-p0` PASS on mocked/offline scenarios; actual staging TTL ACTIVE policies, legal holds and expiration inventory **NOT VERIFIED** |
| CI runner | Automatic validate job failed with runner_id=0 and no test steps | Job labels `ubuntu-latest`; zero Actions repository variables, so no custom runner override. **External allocation/billing/platform reason unresolved**; no false YAML fix or billed rerun |
| Dependency bootstrap | Rules prerequisites recommended `npm ci` despite root Bun-only policy | Corrected to `bun ci`; production runtime/durable fallback denied before any emulator start |
| Supply Chain | Previous Bun audit identified 1 Critical and 4 High advisories on root graph | No versions changed; remediation, SCA re-audit, full build and independent signoffs remain required |

## Mandatory gate requirements

All gates from the owner contract must pass **on the exact source SHA**, including `check:enterprise`, Secrets/Auth/Rules/PII/Art17 source gates, root+Functions SCA, Gitleaks, Semgrep, TypeScript, Vitest, Firebase Rules, Playwright and build. The root intentionally uses `bun.lock`, not `package-lock.json`, so `npm audit --audit-level=high` at the root is **ENOLOCK**, not a clean vulnerability scan. Record independent Bun root and npm Functions audits. Gitleaks/Semgrep are not considered passed unless actually executed. Dedicated real emulator Rules and Art17 test results are still absent. This document must not be changed to GO solely because eight port-profile unit tests pass.

## Required next authorized execution on a suitably provisioned runner

1. Check GitHub Actions billing/runner availability and custom runner groups using administration permissions; record reason for zero-step unassigned job without consuming paid CI minutes prematurely.
2. Install Node 22.23.3, Bun 1.4.2 and Java 21 from verified vendor artifacts. Run `bun ci` from committed root `bun.lock` and npm Functions install separately.
3. Run `npm run check:emulator-profile`, then `npm run test:rules` and `npm run test:art17-partner-emulator` using the real demo-only Firestore Emulator with actual `firestore.rules`. Archive Rules allow/deny and 4 Art17 concurrency/cascade/restart/ownership test outcomes and emulator logs. Do not skip or replace them with static source checks.
4. Re-run all mandatory enterprise tests and remediated dependency/SAST scans; reconcile actual Live Staging TTL list for all 20 groups with independent retention/legal-hold approvals. Only explicit Security/DPO/Legal/SRE human approval may alter release governance.

**GO remains unauthorized.**
