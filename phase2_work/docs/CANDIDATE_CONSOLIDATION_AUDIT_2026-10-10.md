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


## 2026-10-10 — Frozen Vitest invocation in early preflight

Source inspection confirmed the early operational evidence regression used `bunx vitest run ...` even though `package.json` already declares Vitest and its `test` script is `vitest run`. Replaced it with `bun run test tests/operationalControlEvidence.spec.ts`, using the dependency version installed by the preceding frozen `bun ci`, rather than a potentially network-resolved CLI version.

**Observed local diagnostics:** `node --test /mnt/data/klar-report-guard/*.test.mjs /mnt/data/klar-provenance/*.test.mjs /mnt/data/klar-ci-diagnostics/*.test.mjs` completed with **16 PASS, 0 FAIL, exit 0**, Node 22.16.0. These are existing isolated diagnostic files, **not** the full candidate preflight or the newly changed Bun command. The repo candidate's pinned runtime (Node 22.23.3 / Bun 1.4.2 / Java 21) and a clean full checkout remain unavailable here. No remote Actions run, merge, release or cloud verification was performed. **NO-GO** and the user's 100 additional Actions-minute cap remain binding.


## 2026-10-10 — Validation log injection protection

**Confirmed source issue:** `rejectUnexpectedFields` interpolated untrusted JSON property names into error messages. The operational-evidence CLI writes these errors to stderr, so attacker-controlled property names containing newline or ANSI escape sequences could forge visually misleading audit lines. The candidate now emits a fixed, non-reflective error message (`<section> contains an unexpected field`) while still rejecting every extraneous property. Existing `/unexpected field/` regression assertions remain compatible; a new regression tests a property name containing newline and an ANSI escape sequence.

**Executed:** an isolated Node v22.16.0 harness ran three assertions against the corrected helper logic; all **PASS**. This is not a run of the exact candidate's Vitest suite or the full frozen toolchain, which still require a complete checkout, Node v22.23.3, Bun v1.4.2 and Java 21. No new remote GitHub Actions run, deployment or merge was triggered. Production remains **NO-GO**. The 100-minute incremental Actions budget restriction remains binding.


## 2026-10-10 — Explicit release SHA binding before local test execution

A clean checkout alone does not show it corresponds to the *intended* release commit. The preflight now requires `KLAR_EXPECTED_SHA` (exact 40-character lowercase SHA) and compares it to the resolved clean `HEAD` **before** expensive dependencies and tests. Missing, abbreviated, uppercase or mismatched values fail closed. The existing final `verifyLocalProvenance` check still requires the checkout not to change during the run.

From a complete clean checkout of the intended release commit:
```sh
cd phase2_work
KLAR_EXPECTED_SHA="$(git rev-parse --verify HEAD^{commit})" bun run verify:local
```
**Important:** for genuine independent release approval, the value must be pinned in advance by the release process and cross-checked against the artifact/deployment record, not merely derived from whatever happens to be checked out.

**Executed narrow tests:** the new `scripts/expected-sha.test.mjs` ran under local Node 22.16.0: **5/5 passed, 0 failures**. Existing diagnostic tests previously passed 16/16. These are isolated test copies; full exact candidate `verify:local` with Node 22.23.3/Bun 1.4.2/Java 21 remains **PENDING**. No new remote GitHub Actions runs, merge or deployment. Production **NO-GO**; 100-minute incremental Actions limit unchanged.


## 2026-10-10 — Browser acceptance uses frozen local Playwright dependency

Review of `scripts/local-preflight.mjs` identified that the final browser acceptance command still used `bunx playwright test` even after the early Vitest invocation was changed to use the frozen project installation. The application declares `@playwright/test` in its package manifest. The candidate preflight now invokes `bun run playwright test`, resolving the installed local binary from the frozen `bun ci` dependencies and avoiding an implicit remote version resolution.

**Review performed:** verified the changed preflight command against the repository manifest (`@playwright/test` declared) and ensured the browser step remains mandatory and positioned after the production smoke gate. **No full browser test was executed in this runtime**; Node 22.23.3, Bun 1.4.2 and full checkout are still required. No GitHub Actions, merge or deployment. Release remains **NO-GO** with the user's 100-minute additional Actions budget limit intact.


## 2026-10-10 — Executed 21 local diagnostic tests and explicit toolchain evidence

Actually executed in the available container:
```sh
node --test /mnt/data/klar-report-guard/*.test.mjs /mnt/data/klar-provenance/*.test.mjs /mnt/data/klar-ci-diagnostics/*.test.mjs /mnt/data/klar-release-sha/*.test.mjs
```
Observed **21 PASS / 0 FAIL / exit code 0**, duration ~115 ms, Node v22.16.0. This covers isolated report-path, Git provenance, CI diagnostics and expected-SHA checks; **the isolated files are not a verified complete candidate checkout** and no Bun is available.

A separate source improvement now places the successfully validated Node, Bun and Java version strings into `report.toolchain` alongside the exact `report.gitSha` and step results. This makes the future local result easier to audit against mandated Node 22.23.3, Bun 1.4.2 and Java 21. The new report-field change itself has **not** passed a complete pinned-toolchain preflight.

Maintain **NO-GO**: a clean 21/21 isolated diagnostic suite cannot replace the full application tests, Firebase/Playwright runs, signed operational evidence, or human approval. No new GitHub Actions run, merge or deployment; 100-minute incremental Actions ceiling remains binding.


## 2026-10-10 — Missing Chromium provisioning fixed in local preflight

Compared the actual `.github/workflows/ci.yml` with `scripts/local-preflight.mjs`: CI explicitly provisions Chromium (`bunx playwright install --with-deps chromium`) before running browser acceptance, but the standalone local preflight previously ran Playwright directly, without installing its browser binary. This can cause a **false infrastructure failure** on otherwise clean local machines.

The candidate local preflight now runs `bun run playwright install chromium` through the frozen project installation before `bun run playwright test`. This installs browser binaries without deliberately invoking OS-level package-manager changes. **Operator prerequisite:** platform libraries required by Playwright must already be present; on a fresh Linux machine, independently provision them according to the project's approved OS image or Playwright setup. If system libraries are absent, the preflight must fail rather than silently bypass tests. Browser downloads may require network access; keep browser versions locked to the project dependency.

**Validation boundary:** compared CI command with actual current source and committed the local step; full pinned-toolchain/browser acceptance has not been executed here (local Node v22.16.0 and Bun unavailable). No new remote CI, merge or deployment was triggered. Production remains **NO-GO**, incremental GitHub Actions limit **100 minutes**.
