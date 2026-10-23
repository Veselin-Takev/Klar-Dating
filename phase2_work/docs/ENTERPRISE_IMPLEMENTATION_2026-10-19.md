# Enterprise Implementation & Correction Review (Local/Autonomous) — 2026-10-19

**Scope:** Targeted CSP runtime P0 hardening and mandatory gate/SCA verification on the existing unmerged feature branch. **Decision: NO-GO.** No claim that all P0/P1 issues are completed, or that this is a complete independent security audit.

## Executive summary / scope

- **Starting SHA:** `b40b850b79e4d8c6d41417d5cf727c4219c5d4e9`. Main remains unchanged; branch stays Draft.
- **Open GitHub issues:** 15, including P0 #55, #56, #70, #48 and #47; approval issue #8 remains open. These issue numbers do not imply an exhaustive global security backlog.
- **Confirmed P0 finding:** In `server.ts`, production CSP was conditional on `VITE_EMULATOR !== "true"`. A build flag could disable Helmet CSP under `NODE_ENV=production`.
- **Implemented:** `shouldEnforceContentSecurityPolicy()` enforces CSP for production mode, the explicit production deployment label, or recognized Cloud runtime markers. `shouldPermitEmulatorCspSources()` refuses local emulator CSP-origin extensions in production except for explicit local smoke mode with no Cloud runtime marker. The existing local smoke script now requests that exception explicitly. No production deploy.
- **CSP source regression:** `npm run check:csp` PASS under Node 22.23.3: 12 directive existence checks and 3 environment-matrix/runtime-wiring tests. Actual deployed HTTP headers have **not** been tested.
- **Supply-chain findings:** Root Bun 1.4.2 lockfile audit reported **1 Critical, 4 High, 4 Moderate, 3 Low** advisories (the Critical `shell-quote@1.9.0` is in the dev graph via `concurrently@10.0.5`). Root `bun audit --prod --json` reported **1 High** (`source-map-js`) plus 1 Moderate and 2 Low. The separate npm Functions lockfile audit returned zero High/Critical and two Moderate findings (`uuid`, `gaxios`). Counts are advisories, not demonstrated reachable exploits. Full raw root advisories and dependency scope are in `docs/SECURITY_SCA_2026-10-19.json`.
- **Risk disposition:** Production cannot be approved while High/Critical advisories remain unresolved or mitigated without accepted exception and while full compatibility gates are blocked. No blind transitive override or package upgrade was performed: dependencies are not installed and no comprehensive tests can currently run.

## Implementation, threat model and compliance matrix

| Priority | Trust boundary | Confirmed source finding / remaining risk | Patch / status |
| --- | --- | --- | --- |
| P0 CSP | browser-script boundary | `VITE_EMULATOR=true` could disable Helmet CSP despite production environment | Fixed in runtime policy with Node regression; browser/CDN integration unverified |
| P0 CSP | production / emulator origins | Emulator host variables were blindly injected into CSP sources | Cloud markers now suppress these origins; explicit local smoke opt-in; deployed header verification pending |
| P0 dependency | development tooling | `shell-quote@1.9.0` Critical command-injection advisory via `concurrently@10.0.5` dev graph | Not yet upgraded; validate compatible version `>=1.11.0` in isolated branch with actual tests before any release |
| P1 dependency | lockfile application graph | Four other High advisories in full root lock; production-only High `source-map-js` | Prioritize compatible lockfile remediation; no unsupported claim of exploitability or safe fixes |
| P0 privacy | Art.17 / B2B | Genuine emulator concurrency/restart and independent buyer/purchase evidence outstanding (#55/#56) | No new claim of complete compliance |
| P0 TTL | retention / legal holds | 20 TTL groups source-guarded but live Staging state and legal approval pending (#70) | No Cloud changes; remains release blocker |
| P1 monitoring | fleet P95 and CI runners | 300ms source boundary corrected, fleet-level SLI and runner tests missing (#71) | Operational proof outstanding |
| Secrets/SAST | repository history and endpoints | Static `check-secrets` exists; Gitleaks/Semgrep not installed, no history scan | Not signed off |

## Mandatory Gate execution — Iteration 1 (source working tree)

**Runtime:** Node v22.23.3, Bun v1.4.2 checksum-verified separately. 12 requested mandatory commands were evaluated in order (Playwright under `--no-install` to prevent implicit package download). **5 PASS / 7 FAIL/BLOCKED**:

| Mandatory gate | Status and factual blocker |
| --- | --- |
| `npm run check:enterprise` | FAIL; `ERR_MODULE_NOT_FOUND` for TypeScript in `kiErsatzPruefung.mjs` |
| `node scripts/check-secrets.mjs` | PASS (working-tree static scan only) |
| `node scripts/check-auth-boundary.mjs` | PASS (source boundary only) |
| `node scripts/check-public-firestore-rules.mjs` | PASS (static rules check only) |
| `node scripts/check-ai-pii-sanitizer.mjs` | PASS (static sanitizer check only) |
| `node scripts/check-art17-deletion-audit.mjs 0` | PASS (static audit check, not Firestore Emulator) |
| `npm audit --audit-level=high` | FAIL `ENOLOCK` — root intentionally Bun-only and cannot add npm lock under policy |
| `npm run typecheck` | FAIL `tsc: not found` |
| `npm run test:pure` | FAIL `vitest: not found` |
| `npm run test:rules` | FAIL local `firebase-tools` missing |
| `npx playwright test` | BLOCKED; non-installing equivalent `npx --no-install playwright test` cannot find locally installed Playwright |
| `npm run build` | FAIL `vite: not found` |

**Iteration 2:** Source CSP fail-closed criteria strengthened against production runtime mislabelling (Cloud markers); three CSP regressions pass. Non-mutating Bun/Functions audits completed, revealing Critical/High advisories; source-level dependency compatibility upgrade cannot be certified without the full toolchain. **Iteration 3:** perform the final exact-SHA gate attempt; PR body and attached gate JSON serve as terminal results. No fourth attempt within this assignment.

## Security checklist (strictly evidence-scoped)

- [ ] Real Webhook signature/replay/rotation/independent buyer attestation in E2E and concurrency tests
- [ ] Deployed CSP/security header audit, browser Firebase login/Service Worker smoke
- [ ] Real Art.17 cascade emulator and retention/legal-hold audit
- [ ] EU AI Act and GDPR Art.9 end-to-end review (static PII boundary passed only)
- [ ] Production idempotency and Firestore transaction collision tests
- [ ] High/Critical SCA remediation with a clean audit and complete lockfiles
- [ ] Gitleaks or equivalent Git history secret scan and full SAST
- [ ] Malware/source package provenance, approved registry, SBOM/license verification
- [x] No guessing: unavailable evidence explicitly marked incomplete; no production changes

## Recovery / ADR / N-1

See `docs/ADR_CSP_PRODUCTION_FAIL_CLOSED_2026-10-19.md`. This patch changes no Firestore schema, indexes, migrations, OAuth token formats or durable data. N-1 application data compatibility is preserved. Rollback is only a reviewed feature-branch code revert, **not** a sanctioned restoration of the exploitable production CSP switch. No Cloud resource rollback or user-data manipulation is involved.

## Release gate and next actions

1. Fix/upgrade Critical `shell-quote` and all High Bun-root advisories on an isolated branch, lockfile-frozen and tested; preserve root Bun and Functions npm dual graph policy. No silent exceptions.
2. Install validated dependencies in a sufficiently provisioned clean runner; rerun exact full 12-gate sequence, Firestore Emulator and real browser CSP HTTP-header checks.
3. Confirm live Staging retention/Art.17 evidence, P0 B2B identity and purchase binding, remaining user experience issues; obtain independent Privacy/DPO/Legal/Security/SRE signoff before a human GO.

**Current authorization: Draft / NO-GO.**
