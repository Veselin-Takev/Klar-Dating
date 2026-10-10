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
