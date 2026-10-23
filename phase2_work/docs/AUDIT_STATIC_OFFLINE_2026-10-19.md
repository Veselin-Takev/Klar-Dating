# Klar Enterprise static/offline audit — 2026-10-19 (targeted iteration)

**Framework:** `Enterprise End-to-End Audit Framework (Static / Offline)` as provided by the project owner. **Evidence boundary:** this is a targeted continuation of the framework against the integration branch, **not a complete fresh audit** of every file or a release sign-off. Source snapshot: base commit `7adc5c1e0320cfd9826136f2f206bb78ea3dd749`. Human approval: **NO-GO**.

## 1. Executive Summary

- **Audit-Status:** ROT — release gates remain open; the new P0 staging preflight has only offline proof.
- **Critical/High CVEs:** NOT ASSESSED in this iteration (no dependency install, `npm audit` or SBOM-license inventory). Never infer zero vulnerabilities.
- **Compliance gaps:** at least **3 still unverified release controls** in this review: live TTL/retention and legal hold sign-off (#70), true Art.17 Firestore Emulator verification (#56), independent B2B purchase/buyer attribution proof (#55). This is not an exhaustive count.
- **Architecture/Code gaps:** **1 confirmed concrete flaw** corrected in this iteration (staging TTL apply had no existing-policy preflight). Also open: fleet-wide 30-day SLO/P95 evidence (#71) and failed Actions runner allocation (not explained by code tests).
- **TCO-Hebel:** Avoiding unapproved bulk TTL deletion and supporting deliberate retention policy reduces compliance/recovery risk. Quantified saving/ROI **NOT DETERMINED**; missing cloud cost and document volumes preclude an honest estimate.
- **Management Summary:** The verified source contained project/environment/legal approval gates but did not inspect existing TTL policies before 20 sequential staging updates. A new read-only, scope-pinned preflight rejects unapproved or in-progress policies before the first update. Local synthetic negative fixtures prove a fail-closed boundary, not LIVE GCP state. All P0 release blockers and independent reviews stay open. `main` and production are unchanged.

## 2. Detail-Befund (Audit Matrix)

| ID | Domäne | Komponente / Pfad | Befund / CVE / Gap | CVSS / Impact | Handlungsempfehlung | TCO-Impact |
| --- | --- | --- | --- | --- | --- | --- |
| P0-70-A | Retention/DSGVO | `scripts/configure-retention.sh` | Proven missing pre-write TTL policy inspection; now corrected by offline preflight | HIGH potential deletion impact; CVSS NOT assessed | Independently verify staging project identity, existing policies, approved 20-group matrix, expiry inventory and legal holds; obtain change approval | Prevent potential unauthorized deletion/recovery work; not quantified |
| P0-70-B | Cloud evidence | `scripts/check-retention-active-evidence.mjs` | 20 ACTIVE policies not confirmed in genuine staging; preflight subset check not a LIVE compliance certificate | High compliance uncertainty | Run read-only scoped GCP capture in approved staging and archive independently verified evidence | Unknown |
| P0-56 | Art.17 | `src/server/trustAndSafety.ts` | Offline Art.17 tests exist but true 4-scenario Firestore Emulator behavior not proved | High | Complete emulator concurrency/restart/transaction tests, idempotent cascade, audit evidence | Unknown |
| P0-55 | B2B | `src/server/partnerReferralService.ts` | Signed assertion still not independent proof of buyer identity or purchase; event remains pending verification | High fraud/compliance exposure | Authorize independent buyer/purchase binding and provider contract; prohibit credit until evidence | Unknown |
| P1-71 | Observability | `src/server/observability.ts`, `ops/slo.json` | Canonical 300-ms threshold locally tested; 15-minute single-instance gauge is not 30-day fleet P95 proof | Moderate observability risk | Histogram aggregation, 30-day SLI scope, alert delivery and SRE signoff | Unknown |
| P1-CI | CI Operations | `.github/workflows/*` | Automatic Actions run #39233636752 had no runner and 0 executed steps; not a passing pipeline | Deployment assurance blocker | Diagnose allocation/billing/runners without paid reruns; validate locally first | Avoid wasted Actions minutes; unknown savings |

## 3. Action Plan (ICE-prioritized)

**P0:** Complete the new preflight and its negative tests; obtain actual independent 20-group matrix approval and LIVE staging TTL/hold evidence; run real Art.17 Firestore Emulator scenarios; prove independent B2B buyer/purchase evidence. **STOP release** until complete.

**P1:** Diagnose Actions runner `runner_id=0`; run full pinned Node 22.23.3 typecheck/Vitest/Playwright/build/SCA; verify 30-day fleet P95 and pager delivery.

**P2:** Evaluate field-level TTL indexing exemptions and delete costs after telemetry and document inventory; produce SBOM/license inventory and quantify savings only from measured baselines.

## 4. Artefacts/Patches

- `scripts/configure-retention.sh`: GCP project/database scoped *read-only* policy list and before-write preflight.
- `scripts/check-retention-active-evidence.mjs`: explicit `--mode preflight` compatible-ACTIVE-subset validation; standard all-20 ACTIVE mode unchanged.
- `scripts/test-retention-project-identity.sh`: mock zero-write proofs for unknown/in-progress/unavailable existing policies.
- `scripts/test-retention-active-evidence.mjs`: seven preflight-negative fixture types and valid empty/subsets.
- `scripts/check-retention-matrix.mjs`, `scripts/test-retention-matrix.mjs`: enforce ordered preflight and negative mutations against bypass.
- Updated `docs/DATA_RETENTION.md`, `docs/PRODUCTION_RUNBOOK.md`, `docs/PROJECT_STATUS.md` and `RELEASE_MANIFEST.json`.

**Assumptions:** Real Staging credentials and an isolated Firestore Emulator are unavailable in this offline iteration. Cloud resource state, legal approvals, environment-specific status, CVSS scoring and ROI cannot be inferred from static evidence. No application code is merged or deployed as a result of this audit.
