# Candidate consolidation audit — 2026-10-10

**Decision: NO-GO. No merge, remote CI, or deployment authorized.**

## Exact comparison

GitHub's authenticated `compare_commits` result for `main...ci/optimize-llm-evaluation-frozen-install-2026-10-10` reports **ahead 83**, **behind 0**, **15 changed files**, common base SHA `3f0fc4b70551e1d580040e9dd7722931fe87e83d`. The branch has not been validated as one consistent unit. This report describes the branch as it stood at audit time; later documentation commits increment the ahead count. Recheck the exact head SHA before reviewing or testing.

## Change classification and mandatory gates

| Category | Changed files | Acceptance criteria |
| --- | --- | --- |
| CI workflow | `.github/workflows/llm-evaluation.yml` | Frozen install, pinned toolchain, workflow syntax, trigger and spending policy verified |
| Local release preflight | `scripts/local-preflight.mjs`, `scripts/verify-local-provenance*.mjs`, `scripts/report-path*.mjs` | Clean-checkout SHA provenance, external exclusive evidence file, failure propagation, complete pinned toolchain preflight |
| Duration diagnostics | `scripts/analyze-ci-duration*.mjs`, `scripts/analyze-vitest-duration*.mjs` | Exact committed tests pass, missing/partial data reject safely, no sensitive absolute path leakage |
| Operational evidence | `scripts/validate-operational-control-evidence.ts`, `src/server/platform/operationalControlEvidence.ts`, `tests/operationalControlEvidence.spec.ts` | Full positive and negative Vitest, TypeScript in all project configs, real exact-build proof with independently checked approvers |
| Docs | `docs/CI_RESOURCE_POLICY.md`, `docs/GO_LIVE_EVIDENCE_REGISTER_2026-10-10.md` | No claims of a passed whole-project preflight or production controls without linked, current, exact-SHA evidence |

## Immediate P0 release blockers

1. **Missing full clean checkout and pinned tools in this executor.** Node v22.16.0, no Bun; Java 21 present. No meaningful claim of complete local app validation can be made.
2. **83 commits without aggregate candidate tests.** The historical green `main` run is for a different SHA; it cannot approve this branch.
3. **No verified live controls.** Real Cloud Run IAM/identity, secret rotation and revocation, alert-delivery/on-call acknowledgement, telemetry, privacy and rollback need independent production evidence.
4. **No exact candidate signoff.** Production remains NO-GO even when schema-level checks pass.

## Safe next handoff

Use a full clean checkout at the then-current candidate SHA with Node 22.23.3, Bun 1.4.2, Java 21. Run `cd phase2_work && bun run verify:local`, preserve the exclusive private report outside the repository and audit every failing stage. Apply code fixes on the candidate branch, repeat tests on the new SHA. Do **not** start an Actions run unless local validation is clean and the remaining incremental **100-minute limit** has been reconciled using billing/job evidence. Then obtain authorized real-environment evidence under issue #8, explicit human review, and release approval.

Do not call these records "production validated" until their source, runtime, environment, SHA and accountable reviewer are verified.


## 2026-10-10 — Consolidated scope and isolated test rerun

Authenticated comparison to main now reports **84 commits ahead, 0 behind, 16 files changed** (after this document was added). This changes the previously recorded 83/15 inventory. Treat the diff as a moving candidate until a single immutable SHA is frozen.

**Actual available local test command:**
```sh
node --test /mnt/data/klar-report-guard/*.test.mjs /mnt/data/klar-provenance/*.test.mjs /mnt/data/klar-ci-diagnostics/*.test.mjs
```
Observed: **16 pass, 0 fail, exit 0, 92.7 ms**, Node v22.16.0. These are *isolated local copies* and are not sufficient evidence that the full current candidate passes. The TypeScript operational evidence validator and its Vitest suite were not run as a genuine checkout. The correct remediation is to obtain a clean checkout of the frozen branch SHA with Node v22.23.3 / Bun v1.4.2 / Java 21, run complete `verify:local`, and preserve exact-SHA results. Do not consume remote Actions minutes until the full local acceptance succeeds.

This audit deliberately introduces **no new production changes** while complete integration testing is unavailable. Existing code changes remain unmerged. Operational controls and final sign-off are still **NO-GO**.


## 2026-10-10 — Fast-fail operational evidence regression stage

The local preflight now runs `bunx vitest run tests/operationalControlEvidence.spec.ts` immediately after the frozen dependency installation and runtime/CI-scope gates, **before** the expensive enterprise and Firebase integration suites. This pure validation suite has accumulated critical parsing, timestamp, strict-schema and evidence URL regressions. Failing quickly avoids spending local emulator/browser runtime on a candidate that cannot validate operational evidence. The full `test:ci` suite is retained unchanged; this is an additional early gate, not a test bypass.

**Verification:** command placement and Vitest test path checked against current repository sources. The pinned Node 22.23.3 / Bun 1.4.2 whole-project preflight is still **NOT RUN** in the available executor (Node 22.16.0, Bun unavailable and no complete clean checkout). This optimization does not establish a green candidate or authorize any GitHub Actions spend. Issue #8 production controls and human signoff remain open; production **NO-GO**.
