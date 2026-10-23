# Enterprise Review & Correction — 2026-10-19 (local/offline, 3-iteration cap)

**Decision: NO-GO.** Existing unmerged Draft PR #119; base source commit `f3e99bfafc81b8e2102d20429d7e69e7e48aa5f6`. Full production readiness has not been established. No real Cloud or production mutation was performed, no manual paid Actions rerun, no merge, no deployment.

## Executive summary

- **Audit status:** RED / release blocked.
- **Critical/High dependency vulnerabilities:** NOT MEASURED, not zero. Bun-only root has `bun.lock` and deliberately forbids root `package-lock.json`; `npm audit --audit-level=high` at root terminates `ENOLOCK`. Functions have a separate npm lock; no full SBOM/license scan was completed in this iteration.
- **Compliance gaps:** At least three outstanding P0 release tracks: live TTL/legal-hold controls (#70), genuine Art.17 Firestore transaction proof and partner privacy (#56), independent provider buyer/purchase verification (#55). Not exhaustive.
- **Architecture/SLO gaps:** At least two: non-atomic TTL policy provisioning (partially mitigated by preflight/idempotence) and unverified fleet-wide 30-day P95/CI runner availability. No claim of a complete codebase-wide audit.
- **TCO:** Skipping already ACTIVE TTL policies avoids redundant writes to TTL configuration. Estimated cost reduction **NOT QUANTIFIED** (no measured API quotas, Cloud bill or deployment frequency).

## Confirmed issue and remediation

| ID | Priority | Area/path | Confirmed before | Corrected locally | Verification |
| --- | --- | --- | --- | --- | --- |
| P0-70-IDEMP | P0 hardening | `scripts/configure-retention.sh` | After a safe before-write check, the script still requested updates to **all 20** policies even when already ACTIVE | Machine-readable `--mode preflight-ids` returns only validated existing ACTIVE groups; staging apply skips those policies | Mock GCP lists yield **20 / 18 / 0 updates** for 0 / 2 / 20 existing policies; 13 matrix fail-closed mutations cover skip and validated ID output |
| P0-70-LIVE | P0 open | Cloud TTL policy evidence | Actual target state unverified; 20-group matrix approval/expiry inventory/holds remain pending | No Cloud mutation; separate final all-20 ACTIVE evidence checker remains unchanged | **NOT RUN** against real Staging |
| P0-56 | P0 open | Art.17 cascade, partner consent | Four true Firestore Emulator scenarios unverified | No production merge | **NOT RUN** real emulator |
| P0-55 | P0 open | Partner conversion identity/proof | Partner signed assertion does not independently prove buyer purchase or attribution | Existing `pending_verification` behavior retained | **NOT VERIFIED** independently |
| P1-71 | P1 open | API P95 and metrics | 300 ms source policy integrated; fleet 30-day SLI and alerts not attested | Observability static regression passes | **PARTIAL**, no real production monitoring |
| SUPPLY-1 | Blocker | `bun.lock`, `functions/package-lock.json` | npm audit requested at root, but root intentionally Bun-only and forbids npm lock | No policy violation introduced | `npm audit --audit-level=high` → `ENOLOCK`; plan manager-aligned Bun root SCA + npm Functions SCA, with separate explicit approval |
| CI-1 | Blocker | GitHub Actions | Automatic earlier CI jobs received runner_id=0 / no executable test steps | No costly manual restart | CI production gate **NOT VERIFIED** |

## Mandatory local gate runs

**Iteration 1:** Remote sandbox crashed during its Node-22 bootstrapping phase; none of the mandatory gates from that attempt are certifiable. Environment reset, no production side effects.

**Iteration 2:** Node **v22.23.3** verified from upstream SHA256. Unmerged snapshot with the idempotency change. All 12 requested gates were invoked (Playwright with `--no-install` to prevent auto-install). Results:

| Gate | Result | Evidence / blocking message |
| --- | --- | --- |
| `npm run check:enterprise` | FAIL | `ERR_MODULE_NOT_FOUND: Cannot find package 'typescript'` in `scripts/kiErsatzPruefung.mjs` |
| `node scripts/check-secrets.mjs` | PASS | Secret pattern boundary PASS |
| `node scripts/check-auth-boundary.mjs` | PASS | Production Firebase Admin ID token boundary PASS |
| `node scripts/check-public-firestore-rules.mjs` | PASS | Public rules deny unconditional client access |
| `node scripts/check-ai-pii-sanitizer.mjs` | PASS | AI PII sanitizer static gate PASS |
| `node scripts/check-art17-deletion-audit.mjs 0` | PASS | Art.17 static deletion audit PASS; not full emulator |
| `npm audit --audit-level=high` | FAIL | `ENOLOCK`; root intentionally uses Bun lock only |
| `npm run typecheck` | FAIL | `tsc: not found` (dependencies absent) |
| `npm run test:pure` | FAIL | `vitest: not found` (dependencies absent) |
| `npm run test:rules` | FAIL | Firestore prerequisites: `firebase-tools` missing |
| `npx playwright test` | NOT EXECUTABLE | `npx --no-install playwright test`: ENOENT / missing Playwright local dependency; no auto-download permitted |
| `npm run build` | FAIL | `vite: not found` (dependencies absent) |

**Iteration 3:** Final exact committed SHA must be retested. Regardless of source gate results, missing full app/Emulator/supply-chain dependencies and required human signoffs trigger a **hard stop / NO-GO after at most three iterations**. The PR description records final SHA and exact results after execution.

## Security / Compliance Checklist (not an approval)

- [ ] Partner webhook replay/key rotation AND independent purchase/buyer attestation proven in genuine integration tests (OWASP) — pending
- [ ] CSP and security headers verified with deployed application and browsers — static configuration is not production proof
- [ ] Art.17 cascade concurrency / restart / data retention with real Firestore Emulator — pending
- [ ] Privacy/Art.9 and AI PII sanitizer with sensitive-data test cases / independent review — static boundary PASS, fuller verification pending
- [ ] Server-side idempotency under actual concurrent writes — targeted mock regressions PASS; real emulator pending
- [ ] Full dependency/Bun+npm audit and SBOM/license inventory — pending
- [ ] Legal/DPO/Security/SRE independent approval — pending

## Rollback and migration

No Firestore schema, indexes, TTL policy configuration, secrets, API payloads, or data were changed by this patch. N-1 code remains compatible with the unchanged `expiresAt` timestamp schema. Roll back *application code only* to its parent commit if necessary; staging TTL policies must not be automatically rolled back or disabled without a separate signed change ticket. Existing expired data cannot be restored by disabling TTL once deletion has executed. A subsequent approved staging activation must rerun the read-only preflight immediately before changes and re-check all 20 ACTIVE policies after convergence.

Official guidance: https://firebase.google.com/docs/firestore/ttl , https://firebase.google.com/docs/firestore/transaction-data-contention and https://cheatsheetseries.owasp.org/cheatsheets/Webhook_Security_Cheat_Sheet.html .
