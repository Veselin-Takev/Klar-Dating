# Enterprise Single-Iteration Final Verification — 2026-10-10

**Final decision: NO-GO.** Candidate R2 remains frozen at `286a991e776885199bb1028d380e239821de88ac`; this report and subsequent development documentation are **not** part of R2.

## Gate 1 — Codespaces / runner initialization: BLOCKED

Reviewed `phase2_work/.devcontainer/devcontainer.json` and `phase2_work/scripts/setup-codespace.sh`: devcontainer post-create invokes the bootstrap; script targets Node 22.23.3, Bun 1.4.2 and Java 21, checks locked dependencies and local Firebase CLI. The user-provided old fix's root npm lockfile was not reintroduced. These files were **source reviewed**, not functionally executed in Codespaces.

Actual executor: Node **v22.16.0**, Java **21.0.12.1**, Bun **missing**; `/mnt/data` has isolated diagnostics but no full Git repository checkout. `git ls-remote https://github.com/Veselin-Takev/Klar-Dating.git HEAD` failed: **Could not resolve host: github.com**. Thus full initialization is **BLOCKED**, not PASS.

## Gate 2 — Quality / production security

| Gate | Result | Evidence and limit |
| --- | --- | --- |
| Isolated release/CI helper tests | **PASS (21/21)** | Actual `node --test /mnt/data/klar-report-guard/*.test.mjs /mnt/data/klar-provenance/*.test.mjs /mnt/data/klar-ci-diagnostics/*.test.mjs /mnt/data/klar-release-sha/*.test.mjs`, 0 failed; Node 22.16.0; isolated copies only |
| Java 21 pattern | **PASS (isolated)** | Actual Bash expression matched installed OpenJDK 21.0.12.1 |
| Node 22.23.3 and Bun 1.4.2 | **BLOCKED** | Runtime not available |
| Full clean checkout and exact-SHA `verify:local` | **BLOCKED** | Checkout and required runtimes missing |
| TypeScript, enterprise security, install/build | **NOT RUN** | Full source tree and deps missing |
| Firebase Auth/Firestore/Storage emulator tests | **NOT RUN** | Full source/dependencies missing |
| Playwright with Chromium | **NOT RUN** | Full source/Bun/Browser missing |
| Live Cloud Run IAM, alerts, secrets, observability, privacy, canary/rollback | **NOT RUN** | No verified production credentials/control-plane access; GitHub issue #8 open |

**Do not convert NOT RUN to PASS.** Prior green `main` CI does not approve this different candidate.

## Gate 3 — Defects / changes

No unverified product-code change was made in this iteration. The release governance defect is that previously published manifest fields were too coarse to distinguish unavailable tests; the two manifests now explicitly record `BLOCKED`, `NOT_RUN`, `21_PASS_0_FAIL_NODE_22.16.0_ISOLATED_COPIES` and `productionApproved:false`.

## Gate 4 — Artifacts

Updated both root and `phase2_work` copies of `RELEASE_MANIFEST.json` and `RELEASE_NOTES.md`, and this final verification document. Historical origin/release text is not rewritten; today's NO-GO supersedes it.

## Gate 5 — Release decision and next approved action

**NO-GO**, with outstanding P0 technical and live operational evidence. On an approved network-enabled runner, independently select and checkout the exact candidate SHA, provision Node 22.23.3/Bun 1.4.2/Java 21 plus browser/Firebase prerequisites, run `cd phase2_work && KLAR_EXPECTED_SHA=<independently-reviewed-40-character-sha> bun run verify:local`, retain external write-once report and all failures, then consider budgeted remote CI only after complete local PASS. No Actions runs/merge/deploy/production approval occurred here; strict **100 additional Actions-minute** ceiling unchanged. Human production signoff required.


## 2026-10-10 — Infrastructure alignment follow-up

**Implemented:** `scripts/setup-codespace.sh` now invokes `nvm alias default 22.23.3` after installation. Previously `nvm use` affected only the post-create subshell and did not set the default version for new terminal sessions.

**Actually executed locally:** isolated Node regression suite, 21 PASS / 0 FAIL (119 ms) under existing Node 22.16.0. Bash syntax of the newly added nvm command sequence: PASS. These checks are **not** a test of the complete Codespaces bootstrap.

**Connectivity and gate state:** `git ls-remote https://github.com/Veselin-Takev/Klar-Dating.git HEAD` still fails with DNS `Could not resolve host: github.com`; no full checkout, no Bun, and no Node 22.23.3 in this executor. Therefore exact-SHA clean-checkout preflight BLOCKED; TypeScript aggregate/Firebase emulator/Playwright and live cloud security tests NOT RUN. No production access has been established; do not represent tests as passing. R2 exact SHA remains unchanged. No Actions minutes used, no merge, no deployment, formal status **NO-GO**.

## 2026-10-10 — Bootstrap syntax gate hardening

Detected a real coverage gap in `scripts/check-codespaces-bootstrap.mjs`: textual pin checks alone did not reject malformed Bash. Added `spawnSync('bash', ['-n', absoluteBootstrapPath])` and fail-closed handling of nonzero status or process error (commit `fb497fe59fe5cc0e280b56964efb5db42462cf0f`). Existing exact-version, lock and root Codespaces entry-point checks remain in place.

**Evidence boundary:** patch accepted by GitHub; source inspected. Full new check was **NOT RUN on a complete repository checkout** in the current executor (github.com DNS unavailable, Bun and pinned Node missing). The prior isolated diagnostic tests do not validate this code change. An authorized networked runner must execute the gate and the full exact-SHA preflight. No CI minutes, merge, deployment or R2 mutation; production **NO-GO**.

## 2026-10-10 — Codespaces bootstrap guard positive/negative verification

An **isolated fixture** using the current guard source and a representative valid root devcontainer/bootstrap was executed on local Node v22.16.0: valid configuration **PASS (exit 0)**; Bash deliberately corrupted by appending `if then` correctly **FAIL (exit 1)** with `Bash syntax failed`. This proves the targeted Bash-syntax branch in isolation only; it is **not** a full checkout test of actual committed bootstrap files.

To make the check reproducible on an authorized full checkout, added `scripts/check-codespaces-bootstrap.test.mjs` with three Node tests: committed positive fixture, invalid Bash negative case, and missing Bun version-pin negative case (commit `0605a68921c9d4771b9938bb62015147b0fac27d`). Added it to `scripts/local-preflight.mjs` before dependency install (commit `a7bfed54e637876161cca71348f2fe0d3fc08377`). **New committed 3-test suite NOT RUN in this constrained executor**; it must run on a complete repository checkout with exact SHA. No remote CI, merge, deployment or release approval. **NO-GO**.

## 2026-10-10 — Codespaces comment-bypass regression

**Defect:** the bootstrap text scanner could accept a required Bun pin even when that command existed only in a commented-out line. **Fix:** the guard now removes full-line shell comments before checking required commands (commit `817ae73dff7e143a0053c34f2880824aa20adf46`); a fourth checked-in regression case preserves an obsolete pin in a comment while replacing the executable Bun installation with `bun@latest` and requires failure (commit `2a47b9fcf4350fb7cbd8093db3b73e36a9cad505`).

**Actual local isolated test:** representative valid fixture yielded exit **0 / PASS**; modified executable Bun pin plus commented-out legacy command yielded exit **1 / correctly rejected**, diagnostic `Missing Codespaces bootstrap invariant: Bun 1.4.2 installation`. The test used a manually reconstructed copy of the updated logic and a minimal local fixture; it did **not** execute the entire committed test suite on a full Git checkout. Syntax and helper functionality are only partial evidence. Firebase, Playwright, full typecheck, production security and human release approvals still **NOT RUN**. No remote CI, merge or deployment. Frozen R2 remains unchanged. **NO-GO**.

## 2026-10-10 — Actual isolated Codespaces guard regression run

Downloaded/inspected the current development-branch guard, bootstrap and root devcontainer sources, and reconstructed an isolated local fixture under `/mnt/data/klar-bootstrap-check`. Executed the guard with **Node v22.16.0** and actual system Bash against four scenarios via temporary fixture copies. **4 PASS / 0 FAIL**: valid inputs exit 0; invalid Bash syntax exit 1 with syntax diagnostic; executable Bun pin changed to `bun@latest` exit 1; changed executable pin plus historical `bun@1.4.2` comment exit 1. The Bash `-n` static check also succeeded on the valid fixture.

**Scope limitation:** This was an isolated reconstruction/test harness, not the complete committed Node test suite run in a clean Git checkout. Actual Codespaces provisioning, Node v22.23.3, Bun v1.4.2, TypeScript, Firebase, Playwright, live-cloud security and release signoff **NOT RUN**. No deployment or Actions minutes. R2 unchanged. **NO-GO**.


## 2026-10-10 — Node test runner execution for reconstructed bootstrap fixture

**Executed:** `cd /mnt/data/klar-bootstrap-check && node --test phase2_work/scripts/check-codespaces-bootstrap.test.mjs && node phase2_work/scripts/check-codespaces-bootstrap.mjs`.

**Result:** 4 tests passed, 0 failed (TAP reported 1312 ms); the standalone guard printed `Codespaces bootstrap invariants PASS.` Cases covered valid pins, invalid Bash, incorrect Bun pin and commented-only historical pin. Node was **v22.16.0**. Test files in this fixture were reconstructed from inspected development-branch content and are **not independently verified byte-for-byte against a complete Git checkout**. This is a useful targeted regression check only, **not** the mandated exact-SHA/preflight validation.

**Remaining status:** full clean checkout, Node 22.23.3, Bun 1.4.2, Firebase emulator, Playwright, full TypeScript/security tests and human production signoff **BLOCKED/NOT RUN**. R2 must remain frozen. No remote CI, merge or deployment; additional GitHub Actions use 0 this iteration. **NO-GO.**

## 2026-10-10 — Close GitHub CI/bootstrap coverage gap

**Found:** `scripts/check-codespaces-bootstrap.mjs` and its four-case `node --test` suite were wired into `scripts/local-preflight.mjs` but **not** GitHub `.github/workflows/ci.yml`. This meant full-scope CI could install dependencies without detecting a broken or depinned Codespaces bootstrap. **Fixed** on the development branch: the CI `validate` job now executes `node --test scripts/check-codespaces-bootstrap.test.mjs` followed by `node scripts/check-codespaces-bootstrap.mjs`, gated on `steps.scope.outputs.full == 'true'` and placed **before** the dependency lock/install steps (commit `3096706a3659384e74ce5b89f83a36294a0803c3`).

**Evidence:** repository workflow and guard source inspected; GitHub accepted the workflow update. **Not yet verified:** an actual GitHub Actions run of the changed workflow, because remote CI has not been triggered (100 additional minutes hard cap). Earlier four isolated fixture tests are useful partial evidence but do not demonstrate CI execution. R2 is still frozen and excludes the development fix. Full application/type/Firebase/Playwright/security tests remain blocked. **NO-GO.**

## 2026-10-10 — Playwright parity and dependency provenance

**Source finding:** the GitHub CI used `bunx playwright install --with-deps chromium` and `bunx playwright test` while the local exact-SHA preflight called `bun run playwright` and installed Chromium **without** Linux runtime dependencies. This could produce environment-dependent browser failures or command-resolution differences. The development branch now uses the project-installed `bun run playwright` in CI (commit `45f6f4595d76b998bf8632a9eea017ebe5b58166`) and `bun run playwright install --with-deps chromium` in the local preflight (commit `a48a9affaf1ae21bdd1e624962bcfa1b07a50c24`). Both use the local dependency and the same Chromium/Linux-dependencies installer.

**Validation boundary:** exact replacement locations were verified in fetched repository source; GitHub committed the two changes. Neither a full local preflight nor live GitHub CI or browser suite was run; this must be verified on an authorized Linux runner with permissions to install system packages. As before, no Actions minutes, merge, deployment or R2 modification. Full application gates **NOT RUN**, production **NO-GO**.

## 2026-10-10 — Aggregate/release Playwright command consistency

**Finding:** Despite earlier CI and local preflight consolidation, `package.json` scripts `test:all` and `release:verify` still ended with `npx playwright test`, which could resolve a different executable/package than the Bun-locked project. **Fix:** both now use `bun run playwright test` (development-branch commit `dd011ab28cb00d48f5665974349f4299840446cc`). The existing `verify:local` and CI direct Playwright calls already use the project-local Bun execution route.

**Verification performed:** retrieved current `package.json`, parsed its JSON successfully, asserted the two original `npx` script occurrences, replaced them, serialized and parsed the modified JSON, and received GitHub commit confirmation. **Not performed:** a complete pinned-Node/Bun install, TypeScript/Firebase/Playwright tests or live security preflight. R2 remains frozen; this change is not part of R2. No Actions usage, merge or deployment. Production status **NO-GO**.

## 2026-10-10 — Remaining npx execution drift removed

**Source observation:** `package.json` scripts `metrics:evaluate` and `funnel:audit` still invoked `npx tsx`. In the Bun-locked root environment this is an alternate command resolver and can unexpectedly consult a registry. Both were replaced with `bun run tsx` to follow the project's installed dependency graph (development commit `19f931d3511ac858bf23f8e1f895165f4bd87c08`). JSON was parsed, reserialized and reparsed successfully, and **no `npx` references remain among package scripts** at the time of that check.

**Scope:** script configuration validated, **not** the runtime behavior of either analytics task (no full checkout, exact Node/Bun pins or network). Do not infer that the metrics or funnel calculations passed. Full TypeScript, Firebase, Playwright and live production security gates remain NOT RUN. R2 untouched; no Actions jobs, merges or deployments. **NO-GO**.

## 2026-10-10 — Production audit evidence path disclosure remediation

**Verified source issue:** `scripts/audit-production-controls.ts` wrote to a default relative `production-evidence/controls.json` path, potentially within the Git working tree, and printed the full IAM/monitoring audit JSON to console logs. Existing `scripts/report-path.mjs` requires protected external write-once evidence, but the production audit did not use it.

**Fix (development branch `22669dd70415ace86423af4a5fccf2ac3bae66b3`):** Default destination now uses an OS temporary-directory filename containing the current process ID; the existing `validateExternalReportPath(repositoryRoot, output)` enforces the external-path policy and rejects existing target files **before** any GCP calls. As before, JSON is written with `0600` and exclusive `wx`. The program now logs only PASS/FAIL and the evidence path rather than all report details. An operator-supplied `KLAR_PRODUCTION_CONTROLS_OUTPUT` must point to a fresh file in an existing directory outside the repo. The operator must move evidence from temporary storage to restricted immutable retention; temporary storage is not a durable archive.

**Validation:** Fetched and inspected actual repository source and existing report-path helper; GitHub committed the change. **NOT RUN:** TypeScript compilation, real gcloud controls, external-path unit integration or full application preflight in this constrained environment. Source review does not establish production effectiveness. Frozen R2 unchanged; 0 Actions minutes, no merge/deployment. **NO-GO**.

## 2026-10-10 — Production audit evidence regression safeguards

Added `scripts/production-audit-evidence-check.test.mjs` with three lightweight Node source regression tests: external report path validation must precede the first gcloud call; report write must use private permissions and exclusive `wx`; full audit JSON must not be logged. Commit `6d7ba0e502e137f37ff07b053977c33842757cd1`. Existing `scripts/report-path.test.mjs` already contains six behavioral tests for outside/inside repository destinations, symlink parents and targets, existing files, and missing parent directories. The local exact-SHA preflight now runs both test files **before dependency installation** (commit `9fa8dc4877ad6b07b05f3591319514e3225daac2`).

**Verification boundary:** Source code was fetched and test implementation/placement inspected; no complete checkout or pinned-toolchain execution of the new tests was performed in this environment. Real Cloud Run/IAM/monitoring security controls are still **NOT RUN**, and source assertions are not a substitute for runtime tests. Frozen R2 unchanged; no remote Actions run, merge, deployment or approval. **NO-GO**.

## 2026-10-10 — Executed nine isolated production-evidence regressions

Executed on Node **v22.16.0** in `/mnt/data/klar-production-evidence-test`:
`node --test report-path.test.mjs production-audit-evidence-check.test.mjs`.
TAP result **9 tests PASS, 0 FAIL**, duration **382.419442 ms**. The six report-path behavioral tests exercised fresh external targets, repository-local rejection, symlinked parent rejection, existing file rejection, existing symlink target rejection and missing-parent rejection. The three audit source regression tests covered validation before cloud calls, mode 0600 plus exclusive `wx`, and avoiding full JSON report logging.

**Critical provenance boundary:** the test directory was manually reconstructed from fetched development-branch source, and `audit-production-controls.ts` was **shortened to a representative source fixture**, rather than copied byte-for-byte. These results therefore establish isolated guard behavior, **not** an execution of the exact committed nine-test suite against a clean repository checkout. Node 22.23.3/Bun 1.4.2, full TypeScript, Firebase, Playwright and real GCP security audits remain **NOT RUN**. No Actions, merge, deployment or production approval; frozen R2 untouched. **NO-GO**.

## 2026-10-10 — Bounded production gcloud subprocesses

**Verified code risk:** `scripts/audit-production-controls.ts` previously called `execFileSync('gcloud', ...)` without a timeout or output bound. A stalled command could indefinitely block production audit, and very large cloud responses could consume excess memory. **Fix:** all gcloud commands now use `timeout: 30_000` milliseconds and `maxBuffer: 2 * 1024 * 1024` bytes; such failures abort the audit rather than reporting PASS (development commit `4b153d9f5fd408407acacd7dcb5819585fa3bae2`). The production-audit regression suite includes an assertion that the explicit bounds remain set (commit `d59c3c05a1f997dd1520bf2242c1d8a3148e3d0b`).

**Limits:** This is a source-verified mitigation; the newly amended test and the complete gcloud audit were **not executed** under the production/runner toolchain. Cloud projects requiring >2 MiB for an allowed response must review and adjust the policy explicitly, never disable the bound silently. Full exact-SHA preflight and human production approval remain pending. No GitHub Actions or deployments, R2 frozen, status **NO-GO**.

## 2026-10-10 — Ten isolated audit evidence regression tests executed

**Actual command:** `node --test /mnt/data/klar-production-evidence-test/*.test.mjs` under local **Node v22.16.0**. **10 PASS, 0 FAIL**, approximately **236 ms**. This extends the prior nine isolated tests with the `gcloud` timeout/maxBuffer source assertion added in the development branch. The local test fixture was manually updated to mirror the new `execFileSync` options.

**Important limit:** The local `audit-production-controls.ts` remains a **shortened manually reconstructed fixture**, not the complete byte-identical GitHub file or a clean checkout. These tests **do not validate actual TypeScript compilation, Firebase, Playwright, Cloud Run APIs, IAM policies or the production configuration**. No further product code was changed in this iteration. Full frozen-SHA preflight remains blocked by missing complete checkout, exact Node 22.23.3, Bun 1.4.2 and working GitHub DNS. R2 remains frozen; GitHub Actions additional consumption **0 this iteration**, no merge/deployment. Official decision **NO-GO**.

## 2026-10-10 — Production evidence regressions now wired into CI

**Confirmed coverage gap:** GitHub `.github/workflows/ci.yml` did not invoke `scripts/report-path.test.mjs` or `scripts/production-audit-evidence-check.test.mjs` as its own pre-install gate, although local preflight did. Added `Production audit evidence regressions` to the full-scope CI path before lockfile/dependency installation (development commit `d88428e68afe50b4a41a4e532220b605655f3904`).

**Resource cleanup:** local preflight previously included `report-path.test.mjs` in its `CI diagnostic unit tests` block and again in `Production evidence path and disclosure regression`. Removed the first invocation; the complete path test suite still runs with the production audit source checks in the dedicated pre-install step (development commit `1f6c1a7b71135704db24626aa49674dab9900d27`).

**Verification:** inspected GitHub source and exact replacement anchors; both commits confirmed. **Not claimed:** executing changed CI or exact-repository tests, complete Node/Bun preflight, Firebase/Playwright/cloud security. R2 frozen; no Actions consumed, merge or deployment. **NO-GO**.

## 2026-10-10 — Explicit CI scope regression for security controls

**Finding:** The CI scope policy already defaults to full validation for non-allowlisted files, but its tests did not explicitly enumerate the recently modified production-audit, report-path, bootstrap and devcontainer security surfaces. **Fix:** extended `scripts/ci-scope-check.mjs` with a table-driven test verifying that PR modifications to each of six critical files trigger full CI (development commit `578277ddf53c73d604dfa7fd3444b18c855ed7d2`). This prevents silent expansion of the cheap narrative-only lane to these files.

**Verification:** code inspected and committed; remote CI not run, and full pinned-toolchain clean-checkout testing remains pending. This is a regression-hardening change, not evidence of passed full enterprise gates. Frozen R2 untouched, no Actions minutes/merge/deploy, **NO-GO**.

## 2026-10-10 — Four CI scope policy regression tests executed locally

Executed the four test cases from `scripts/ci-scope-check.mjs` in an isolated local reconstruction of the fetched `scripts/ci-scope.mjs` on **Node v22.16.0**: `node --test /mnt/data/klar-scope-check/ci-scope-check.mjs`. TAP result **4 PASS, 0 FAIL**, approximately **253 ms**. Verified the narrative allowlist, code/rules/workflow mixed-change escalation, push/empty fallback to full validation, and six security/bootstrap paths requiring full validation on pull requests.

**Provenance boundary:** isolated files were manually reconstructed from inspected source; no byte-identical full Git checkout or GitHub CI run occurred. Exact pinned Node 22.23.3/Bun 1.4.2, TypeScript/Firebase/Playwright and live GCP production controls remain **NOT RUN**. This iteration changes no product code, consumes no Actions minutes and does not change R2. **NO-GO**.

## 2026-10-10 — CI scope subprocess resource bounding

**Confirmed source issue:** `scripts/ci-scope.mjs` invoked `git diff --name-only ...` synchronously without a timeout/output bound. A stalled or unexpectedly large diff could block the CI scope gate. **Fix:** `execFileSync('git', ...)` now has `timeout: 15_000` and `maxBuffer: 1024 * 1024`; its existing catch retains the fail-closed default `full=true` on subprocess failure (development commit `36d4fcd1454c9fbb5e9302b05dc743ed954b55bd`). Regression source assertion added to `scripts/ci-scope-check.mjs` (development commit `cb49fab3ea0af40597989b0ecad336e4765d49fe`).

**Verification boundary:** reviewed actual repository files and confirmed GitHub updates. The amended test and entire CI workflow **have not been executed** in a complete clean checkout or on Actions; pathological git execution was not simulated. R2 frozen, no Actions minutes, merge or deploy; production remains **NO-GO**.

## 2026-10-10 — Bounded CI scope regression checked in isolation

Executed `node --test ci-scope-check.mjs` against a manually reconstructed current five-test CI-scope fixture under Node **v22.16.0** (`/mnt/data/klar-ci-scope-current`). TAP: **5 PASS, 0 FAIL**, elapsed approximately **297 ms**. The fifth test checked the `git diff` subprocess timeout/output bounds and fail-closed source pattern; prior cases checked narrative allowlist, mixed changes, push/empty fallback, and six security/bootstrap files.

**Provenance caveat:** This was a manually reconstructed source fixture, **not** a byte-for-byte verified checkout of the branch and not the required exact toolchain. No full CI job, TypeScript, Firebase, Playwright, or live production cloud audit was performed. There were no further product changes this iteration. Frozen R2 remains unchanged and official production status is **NO-GO**; 0 additional GitHub Actions minutes, no merge/deploy.

## 2026-10-10 — CI rename/deletion safety regression

Inspected `scripts/ci-scope.mjs`: the existing `git diff --name-only --no-renames` deliberately reports deletions and additions separately, so a code-file rename into an allowlisted narrative path must still trigger full CI. Added a dedicated regression case in `scripts/ci-scope-check.mjs` covering source/destination and deletion semantics, plus a source assertion that `--no-renames` remains present (development commit `ec73e41a1b9d5e56b7b824c6a0a392239e4cb2f6`). **No exploit was identified in the current implementation**; this is prevention of a future policy regression.

**Limits:** Current policy source checked and test committed; complete clean-checkout execution, CI and production security checks remain pending. No Actions, merge, deployment or R2 modification. Official **NO-GO**.

## 2026-10-10 — CI rename scenario exercised against real Git

**Executed locally:** `node --test /mnt/data/klar-ci-scope-current/ci-scope-check.mjs` with Node **v22.16.0**. TAP **6 PASS, 0 FAIL** (301.18 ms); new regression checks renamed/deleted code paths and retention of `--no-renames`. The local test files were reconstructed from retrieved development-branch source, not an independent clean full checkout.

**Additional real-git integration experiment:** initialized a fresh temporary repository, committed `phase2_work/src/App.tsx`, renamed the file with `git mv` to allowlisted `phase2_work/docs/PROJECT_STATUS.md` and committed the change. `git diff --name-only --no-renames BASE...HEAD` reported **both** original code path and destination. Invoking the current locally reconstructed `ci-scope.mjs` with the commit SHAs and `GITHUB_EVENT_NAME=pull_request` printed **`Full validation required.`**; the temporary repository was removed.

**Limitations:** targeted Git behavior confirmed in synthetic repository, **not** a complete pinned-Node/Bun Klar checkout or live GitHub Actions. Full TypeScript/Firebase/Playwright/Cloud security tests remain NOT RUN. No additional product-code changes, no Actions minutes, merge or deploy; frozen R2 untouched and production remains **NO-GO**.

## 2026-10-10 — Local preflight process hang protection

**Confirmed source defect:** The local exact-SHA preflight invoked all build/emulator/Playwright subprocesses using unbounded `spawnSync`, so a hung subprocess could stall indefinitely without writing final evidence. **Fix:** each preflight step now has a default 15-minute subprocess timeout and `SIGTERM` kill signal; Bun/Java version probes have a 15-second timeout. As before, `result.error` or nonzero exit status results in FAIL and triggers attempt to persist external write-once evidence (development commit `e1f3e900c722d368fb00c675dcd338a774f39388`). This is a per-command bound, not an end-to-end duration cap; a stalled command tree or teardown may require operator intervention.

**Validation limit:** fetched current source, applied exact anchored replacement, GitHub committed; no complete checkout/Node 22.23.3/Bun 1.4.2 available to run the amended preflight. Existing CI job still caps its run at 45 minutes. Official production gate remains **NO-GO**, frozen R2 unchanged, no Actions minutes/merge/deploy.

## 2026-10-10 — Timeout evidence distinguishes ETIMEDOUT

**Runtime observation:** A local Node child-process experiment using `spawnSync(process.execPath, ['-e', 'setTimeout(() => {}, 10000)'], {timeout:100})` returned `status:null`, `signal:'SIGTERM'` and `error.code:'ETIMEDOUT'`. The local preflight evidence previously recorded only generic FAIL/exitCode/signal, obscuring timeout cause. It now records `timedOut` and `errorCode` for each subprocess step (development commit `278142484d51445f7fe9e58c24128adea43e7a45`). A two-case Node test for actual child timeout and source evidence invariants was added (commit `5e2e40ca051b7eba3581344bec62bf2d04f58c84`) and is invoked by preflight before installation (commit `9a9905611264396a95e11d8452315718f3ebe36c`).

**Validation boundary:** The standalone child-process experiment was executed locally. The newly committed test file was not yet executed on a complete checkout under the required Node 22.23.3/Bun 1.4.2; complete TypeScript/Firebase/Playwright/Cloud security gates remain **NOT RUN**. R2 unchanged; no Actions, merge/deployment or production approval. **NO-GO**.

## 2026-10-10 — Executed timeout regression and CI wiring

**Actual local test:** `node --test /mnt/data/klar-timeout-regression/local-preflight-timeout.test.mjs` under Node **v22.16.0** yielded **2 PASS / 0 FAIL** (355 ms). Case 1 executed a genuine deliberately hung Node child, observed `ETIMEDOUT` and `SIGTERM`; case 2 checked the timeout/evidence pattern in a **shortened local source fixture**, not a byte-identical full preflight source. This is **isolated evidence**, not a completed release test.

**CI gap fixed:** Added full-scope `Preflight timeout regression` in `.github/workflows/ci.yml`, running the committed `scripts/local-preflight-timeout.test.mjs` before dependency installation (development commit `21c703848ad766e4171566e1cd4cb93424e658c6`). The remote workflow has **not** run. Full checkout, exact Node 22.23.3 and Bun 1.4.2, TypeScript/Firebase/Playwright/Cloud security evidence and formal human approval remain **NOT RUN**. Frozen R2 unchanged, no Actions minutes/merge/deploy; official **NO-GO**.

## 2026-10-10 — Byte-identical timeout test verification

Ran `node --test local-preflight-timeout.test.mjs` in `/mnt/data/klar-timeout-regression` under local Node **v22.16.0**: **2 PASS, 0 FAIL** (256.893613 ms). Git blob hashing confirmed the locally executed **test file** is byte-identical to the development branch: `git hash-object local-preflight-timeout.test.mjs` = GitHub fetched file SHA **`2f2c90e6b08a61e904b840250496a21e457c3867`**. This supersedes the prior uncertainty about test-file reconstruction.

**Critical remaining qualification:** the accompanying local `local-preflight.mjs` is an abbreviated source fixture (`git hash-object` **`4000af95d9ebb0676bf1aa41ab9ea97a6a3accd4`**), not the repository source SHA **`ced4d91aeb5fd02611e4a93c0c3bc26dd21ba2ee`**. Therefore the child-process behavior test is against original test bytes but the second source assertion is not validated against original production/preflight source. Exact checkout + pinned Node 22.23.3/Bun 1.4.2 and complete TypeScript/Firebase/Playwright/cloud checks remain **NOT RUN**. This iteration made no application-code modifications. No Actions, merge, deployment; frozen R2 unaffected; **NO-GO**.

## 2026-10-10 — Exact original local-preflight source tested with original timeout suite

**Improved provenance evidence:** obtained the full current development-branch `scripts/local-preflight.mjs` and confirmed its local `git hash-object` equals GitHub SHA **`ced4d91aeb5fd02611e4a93c0c3bc26dd21ba2ee`**. The already-verified local `scripts/local-preflight-timeout.test.mjs` is also byte-identical to its GitHub SHA **`2f2c90e6b08a61e904b840250496a21e457c3867`**. Executed `node --test local-preflight-timeout.test.mjs` on these two original files under local Node **v22.16.0**: **2 PASS, 0 FAIL**; TAP duration **245.277461 ms**. The source assertion therefore now applies to the **full exact original preflight file**, correcting the earlier abbreviated-fixture limitation.

**Still unverified:** No full exact-SHA project checkout or execution of the complete `verify:local` workflow, Node 22.23.3/Bun 1.4.2 dependency installation, TypeScript, Firebase, Playwright or live Cloud Run/IAM/monitoring checks. Regression PASS is not a production GO signal. No Actions minutes, R2 changes, merges or deployments; official **NO-GO**.

## 2026-10-10 — Exact-source syntax and timeout regression recheck

**Actual local execution** from `/mnt/data/klar-timeout-regression` on Node **v22.16.0**: `git hash-object local-preflight.mjs` returned exact development-branch blob **`ced4d91aeb5fd02611e4a93c0c3bc26dd21ba2ee`**; `node --check local-preflight.mjs` passed; `node --test local-preflight-timeout.test.mjs` returned **2 PASS, 0 FAIL**, TAP overall runtime ~**17.13 seconds**. The timed-out test subprocess was slower to settle than the configured 100 ms (individual test time ~3.82 seconds). This targeted observation warrants runner stability verification, but alone does not prove a production defect or a failure of the 15-minute preflight bound.

**No speculative code change:** the targeted original-source syntax and timeout assertions passed. Full exact-SHA repository checkout, Node 22.23.3/Bun 1.4.2, TypeScript, Firebase, Playwright, cloud security evidence and human signoff **remain NOT RUN**. Frozen R2 unchanged; no additional Actions minutes, merge or deploy. Production decision **NO-GO**.

## 2026-10-10 — Toolchain probe error handling

**Confirmed source issue:** in `scripts/local-preflight.mjs`, Bun/Java `spawnSync` probe outputs were parsed without checking `result.error` and without null-safe stdout/stderr handling. Missing executables or timed-out child processes may yield absent output, causing an unintended JavaScript exception instead of the intended toolchain-policy failure message.

**Remediation (development branch):** Bun checks `bun.error` and `bun.stdout?.trim()`; Java checks `java.error`, coalesces null stdout/stderr for version parsing, and keeps the required Java 21 verification. Commits `eb1b9f2e2f3020c121d75faba960cf8a70764602` and `53ee2c5237031ffd1ab12a7342b2e7a470c64dee`. Existing catch/finally logic continues to mark FAIL and attempts secure write-once external reporting.

**Verification boundary:** exact GitHub source reviewed and committed, but modified preflight not yet executed under pinned Node 22.23.3/Bun 1.4.2 or a complete checkout. Full application/cloud gates NOT RUN. R2 frozen, no Actions minutes, merge or deploy. Official **NO-GO**.

## 2026-10-10 — Toolchain missing-executable regression coverage

**Verified risk in current source:** Node `spawnSync` may produce `error.code='ENOENT'` and `stdout=null` when `bun` or `java` does not exist. The local preflight now guards those values but lacked direct regression coverage for that failure. Extended the existing `scripts/local-preflight-timeout.test.mjs` with a real subprocess test of a deliberately nonexistent executable and source assertions for guarded Bun/Java probes (development commit `3aa2912edd0819c4781af60d403b94bd6a440ac4`). Existing CI and local preflight already invoke this test file, so no additional CI workflow step was needed.

**Evidence boundary:** inspected original development-branch code and committed regression coverage; the amended tests have **not yet been executed** in a byte-identical clean checkout or on the pinned Node 22.23.3/Bun 1.4.2 runner. Full TypeScript/Firebase/Playwright/production IAM and Cloud controls remain NOT RUN. R2 frozen, no Actions/merge/deploy, production **NO-GO**.

## 2026-10-10 — ENOENT regression test fixed and executed with original source

**Actual detected test defect:** The newly added missing-executable test asserted `missing.stdout === null`, while local Node **22.16.0** returns `undefined` for this ENOENT case. First run: **2 PASS / 2 FAIL**; the second failure came from a stale local `local-preflight.mjs` fixture missing the current Java guard. **Fixed** the test to accept nullish missing stdout (`missing.stdout == null`), development commit `6b04619becb8039e4081d1dd77a6695237ffdeb7`.

**Actual final execution:** Refreshed both local files to byte-identical GitHub blobs: test SHA **`063148f3610e9a41d5d4d4b4b4bb2df941d57911`**, preflight SHA **`aeb376046793f52b43b509d028ad60b653f15ab1`**, confirmed with `git hash-object`. `node --test local-preflight-timeout.test.mjs` yielded **4 PASS, 0 FAIL**, ~**244 ms** on Node 22.16.0. These are genuine original-file targeted tests, **not** full pinned-toolchain validation.

**Remaining gates:** full clean checkout, Node 22.23.3/Bun 1.4.2, TypeScript/Firebase/Playwright, live Cloud Run/IAM/monitoring audit and human approval NOT RUN. Frozen R2 untouched; 0 Actions minutes, no merge/deployment. **NO-GO**.

## 2026-10-10 — Cache restore after cheap fail-fast checks

**Verified CI ordering inefficiency:** GitHub `.github/workflows/ci.yml` restored npm/Bun/Firebase dependency caches *before* running the dependency lockfile gate and Codespaces/production-evidence source regressions. These cheap security checks should fail fast before cache actions are incurred. **Fix:** Moved the existing `Restore dependency downloads` step to immediately after `Dependency lock preflight`, before `Install dependencies` (development commit `8860280ae24566c87d211bb3cda220de89cf28da`). Cache key and paths remain unchanged. Source order now: Codespaces regression → production evidence regressions → dependency lock gate → restore downloads → install.

**Verification:** fetched and modified current CI YAML source, GitHub accepted commit; no remote workflow execution or measured minute savings. Root R2 remains frozen, no Actions minutes, merge or deployment. Full exact-SHA TypeScript/Firebase/Playwright/security verification remains outstanding; official **NO-GO**.

## 2026-10-10 — Defer npm cache until cheap CI gates succeed

**Confirmed remaining ordering inefficiency:** Although explicit `actions/cache` had been moved past fast checks, `actions/setup-node` was still configured with `cache: npm`, which implicitly restores npm cache earlier. **Development fix:** `setup-node` now only provisions the pinned Node 22.23.3; the existing post-gate `actions/cache` restores `~/.npm` alongside Bun and Firebase download caches and keys on both `phase2_work/bun.lock` and `phase2_work/functions/package-lock.json`. This retains dependency cache reuse without caching before Codespaces, security-evidence and lockfile checks (commit `585e2980a047528e4f620985f042511521669a75`).

**Scope and limits:** static GitHub workflow review and commit only, no actual Actions execution or quantified cost savings. `check-runtime-node-alignment.mjs` is a static policy/manifest check and does not inspect current `process.version`; its position before setup-node was not an actual pinned-version error. Full clean-checkout Node 22.23.3/Bun 1.4.2/Java 21, TypeScript/Firebase/Playwright, production cloud controls, and official approval remain **NOT RUN**. R2 frozen, 0 additional Actions minutes, no merge/deploy, status **NO-GO**.

## 2026-10-10 — CI cache-order regression guard

**Checked current workflow:** `actions/setup-node` no longer performs implicit npm-cache restore; the single cache step occurs after Codespaces bootstrap, production audit evidence regressions and dependency lock preflight. The cache key includes both Bun and Functions npm lockfiles. Added an automated regression in `scripts/ci-scope-check.mjs` asserting this order, absence of implicit `cache: npm`, inclusion of `~/.npm`, and both lockfiles in the key (development commit `c9aef42458a917a1255f4d5d3cbdb8336e2c9184`). Existing CI already runs that regression suite on every PR.

**Validation boundary:** inspected the actual GitHub workflow and committed the test; this newly added test has **not** been executed on the pinned toolchain or by GitHub Actions. No measured CI savings. Complete build/emulator/Playwright/GCP-security tests and human approval still missing. R2 frozen; no Actions minutes, merge, deploy; official **NO-GO**.

## 2026-10-10 — Cache ordering regression executed in isolated local fixture

**Actual local command:** `node --test /mnt/data/klar-ci-scope-current/phase2_work/scripts/ci-scope-check.mjs` on Node **v22.16.0** returned **7 PASS, 0 FAIL** (TAP 575.98 ms). The new cache-order regression passed when run against a **shortened locally reconstructed CI YAML fixture** reproducing the required order, npm path, and two-lockfile key. Current live GitHub original workflow (`.github/workflows/ci.yml`, blob `b4d2948b7afad77cf94bcd158a7c7e9548b8d09e`) was independently inspected and contains matching order/key. **Do not count this as byte-identical current-source end-to-end regression evidence**; source/test fixture was reconstructed and reduced.

No product-code changes in this iteration. Remaining: exact original full checkout and pinned toolchain Node 22.23.3/Bun 1.4.2/Java 21, full TS/Firebase/Playwright and production Cloud security audits, and human signoff. No GitHub Actions minutes, merge or deploy; R2 frozen; official **NO-GO**.

## 2026-10-10 — Cache scope regression verified with exact original files

**Completed previously missing check:** Locally reconstituted all three relevant source files and verified Git blob identity with the *current development branch*: `scripts/ci-scope-check.mjs` = `5243d6646392ddf16b4fdbe3fb7d5cd59eccba52`, `scripts/ci-scope.mjs` = `d43074974e4b42795971e8d3aa2ed989838e7b65`, `.github/workflows/ci.yml` = `b4d2948b7afad77cf94bcd158a7c7e9548b8d09e`. All three local `git hash-object` values matched fetched GitHub blob SHAs. Ran `node --test phase2_work/scripts/ci-scope-check.mjs` under local Node **22.16.0**: **7 PASS / 0 FAIL**, TAP total **190.20 ms**, including the cache-order regression. This **supersedes** the earlier shortened-workflow-fixture limitation for these targeted tests.

**Limits:** These are three byte-identical individual source files, not a full project checkout; not executed under pinned Node 22.23.3/Bun 1.4.2, and no complete app/typecheck/Firebase/Playwright/production-security gates or official signoff occurred. No CI Actions minutes consumed, no application code changes, no merge/deploy; frozen R2 unchanged. Official **NO-GO**.

## 2026-10-10 — P0 monitoring evidence fail-open corrected (GitHub Issue #8)

**Production gate defect confirmed in original source:** `auditMonitoring` accepted a notification channel as usable unless explicitly `UNVERIFIED`, including missing verificationStatus. It treated a required policy as enabled unless `enabled === false`, and did **not** establish that the required policy actually referred to an enabled/verified channel. Consequently an unrelated verified channel plus an undeliverable required alert could produce a false PASS.

**Fix on development branch** (commit `eec9acc7ece6de6c5817cb3206cfa3461f901081`): each required named alert must be explicitly enabled, carry no API-reported `validity` failure, and reference via `notificationChannels` at least one channel with an exact resource name, not disabled, and explicit `VERIFIED` status. All other combinations fail closed. Non-verified or verification-exempt channel types require separate human operational evidence and **cannot** satisfy this strict automated verification criterion. Regression tests added/updated in `tests/productionControls.spec.ts` (commit `b0651a7181b067494b73acb7dc538d5a10783dd2`).

**Executed local targeted verification:** fetched full source and recreated `productionControls.ts` byte-for-byte; `git hash-object` = committed GitHub content SHA **`58373787084f191a9fc89c1b0f8134e556f9eb83`**. Node v22.16.0 `--experimental-strip-types --test` executed **11 independent Node assertions: 11 PASS, 0 FAIL** (enabled linked channel accepted; unrelated channel, missing notificationChannels, unknown/unverified/disabled/unnamed channel, unknown/disabled/invalid policy and missing required policy rejected). Standalone `tsc --noEmit --target ES2022 --module NodeNext --moduleResolution NodeNext --strict --skipLibCheck productionControls.ts` **PASS**. This is a targeted regression harness; the repository Vitest suite and full project build **were not run** under the required Node 22.23.3/Bun 1.4.2.

**Operational runbook corrected** in `docs/PRODUCTION_CONTROLS_AUDIT.md` (commit `74a4d681b0088e6893ff9ef887a899a4a9c9b1e7`): audit defaults to private write-once output in OS temp dir, NOT `production-evidence/controls.json` under the repository; output path must be externally approved. `KLAR_EXPECTED_SHA` remains mandatory. A config audit does **not** prove alert delivery to on-call, secret rotation, GCP IAM controls, production workload status, or human signoff.

**Release decision:** no real Cloud Monitoring audit, alarm delivery exercise, Cloud Run/secret verification or human signoff; no actions run on this development branch (no open PR detected and no workflow runs found for code commit); no merge/deploy. Frozen R2 untouched. **NO-GO**.


## 2026-10-10 — Cloud Run Secret Manager alias and IAM false-PASS fixes (Issue #8)

**Confirmed P0 audit defects:** The collector historically queried `gcloud secrets get-iam-policy` by *required environment-variable name*, but Cloud Run v1 uses `valueFrom.secretKeyRef.name` and may resolve that name through a template `run.googleapis.com/secrets` alias to an entirely different, potentially cross-project Secret Manager resource. A separate flatten-to-Map operation discarded earlier duplicate required variables across containers. Finally, `auditSecretPolicies` considered conditional accessor IAM bindings sufficient without checking whether their conditions were currently true. These behaviors could generate a false production audit PASS.

**Implemented on development branch:**

- `tests/productionControls.spec.ts` new negative and positive cases covering resolved aliases, cross-project resource references, malformed and duplicate mappings, duplicate required env entries, unsafe secret reference names and conditional Secret Manager permissions; commits `4be75284226728a004d7ffbfa84b46db6cbb5caa`, `992bdff049734e6abbb8d710a055f1a33537587b`.
- `src/server/platform/productionControls.ts`: resolve alias annotation, expose sanitized `secretReferences`, reject ambiguous required variable definitions and malformed mapping; reject conditional-only accessor IAM grants as sufficient for guaranteed access; commits `842eaf3ca13f9e1e5bcdba996ddc04804a7575fb`, `909f75064666acf080832f899db7bbe31ef0d078`.
- `scripts/audit-production-controls.ts`: query IAM on each *resolved actual* secret resource, keyed for the existing `auditSecretPolicies` check; commit `0288c1f2a66b503e117156388226ca349aa5aaaf`. Source-level guard added to `scripts/production-audit-evidence-check.test.mjs`, commit `2282654338770b7fc2b2bdb0ac00b119236765c9`.
- `docs/PRODUCTION_CONTROLS_AUDIT.md` updated with alias contract, duplicate-variable **[ANNAHME]**, cross-project audit limitations and conditional IAM fail-closed expectation; commit `72164b65c243e72b5b6834e8d8d2feb7d2d79391`. The root `GO_LIVE_CHECKLIST.md` now starts with a current, explicit NO-GO gate instead of relying on its historical September summary; commit `d4a9a15739dcd315d2f2277818a8531fa253f219`.

**Executed locally, Node v22.16.0 (not approved pinned runtime):** `productionControls.ts` reconstructed byte-for-byte and verified with `git hash-object` against committed GitHub blob **`6e55f53f54aced8838b528ffcdf9d92abc4e84f9`**. Independent `node --experimental-strip-types --test` harness: **23 PASS / 0 FAIL** for monitoring, alias resolution, duplicate configurations, cross-project resource names, malformed mappings and conditional IAM. Targeted standalone `tsc --strict --noEmit --target ES2022 --module NodeNext --moduleResolution NodeNext --skipLibCheck productionControls.ts`: **PASS**. `audit-production-controls.ts` and `production-audit-evidence-check.test.mjs` recreated byte-for-byte and verified against GitHub blobs **`54d8bf21a7f0affd2a191c7f4cd0438e0066ed1c`** and **`30c60451e2cf2a3412d60c0aa70c414af231ef90`**; `node --test` source invariant suite: **5 PASS / 0 FAIL**. The added Vitest cases were committed but **not executed as full repository Vitest**; standalone tests do not substitute for it.

**Remaining NO-GO gates:** Full pinned-toolchain Node 22.23.3/Bun 1.4.2/Java 21 CI, real Cloud Run `gcloud` responses and actual secret IAM permissions, Cloud Monitoring notification-delivery and on-call acknowledgement, rotation and rollback proofs, privacy/firestore/e2e acceptance, human approvals. No real cloud credentials were accessed, no paid GitHub Actions runs, merge or deployment. R2 remains frozen. **Release decision: NO-GO.**



## 2026-10-10 — IndexedDB offline queue owner-index read optimization (FE-02)

**Actual code change:** `src/lib/offlineQueue.ts` no longer calls a whole-store `getAll()` for per-user checklist or message replay. Checklist reads now use a primary-key lookup and double-check the `ownerUid` embedded in the record; offline send loop and remaining-item count use `index('ownerUid').getAll(IDBKeyRange.only(ownerUid))` via `src/lib/offlineQueueIndexedReads.ts`. Existing queue schema v3, ordering, retries, dead-letter semantics and atomic enqueue capacity remain unchanged. Commits `aeb34e2321272f08f6d59ac6f0a132c813a5fef7`, `20c2f07268bf88596c904779fd24859cba41ac71`, `9664fd2bf1636f78fdd8219298f203a539f11b10`.

**Validation actually performed:** Original helper's Git blob SHA `b7aa13be871cf4f8eb2755a39657a8227f085f35` exactly matched local file; strict `tsc --noEmit` using DOM types **PASS**, targeted Node v22.16.0 `--experimental-strip-types --test` **2 PASS / 0 FAIL** (in-memory mock simulates IndexedDB requests and exercises owner-index / primary-key selection). Six static checks of current GitHub `offlineQueue.ts` and helper also PASS. **Note:** Only the helper and the isolated two-case test harness were locally executed, NOT the entire `offline-queue-index.test.mjs` against byteidentical complete app source or actual browser IndexedDB. Committed six-case regression is now part of early full-scope GitHub CI and local preflight (commits `b198bbd593458773ce3a3a88275b2052d1c94e39`, `24abea646276d7c359de4d778461436ab2473666`, `6b920d64d4e4f64789626b5444d6241f13393bfe`).

**Outstanding security review:** A separate legacy in-memory queue `enqueueChatMessage` deduplicates across owners using only clientMessageId, and `syncQueuedActions` takes no ownerUid. Its usage must be inventoried and isolated before considering the full offline messaging lifecycle production-ready. Full TS/Vitest/browser/emulator exact Node 22.23.3/Bun 1.4.2/Java 21 gate, measured browser resource improvements and human/go-live acceptance remain **NOT RUN**. No Actions minutes used, frozen R2 unchanged, no merge/deploy; **NO-GO**.


## 2026-10-10 — Legacy memory offline queue owner isolation

**Confirmed security bug:** Legacy `enqueueChatMessage` previously deduplicated by message ID alone, while `getQueuedActions`, `getQueuedMessagesForChat`, `syncQueuedActions` lacked mandatory account-scoped access. The legacy message queue was not cleared by `AuthContext.logOut`, and shared memory diagnostics could be written to the currently authenticated account's user-scoped local storage even when they originated from a different account.

**Remediated on dev branch:** UID+message-ID deduplication and per-owner cap; ownerUid required for reads and replay; bearer token mandatory before sending; only that owner's messages selected. Logout now calls `clearQueueForUser(uid)`, clearing both memory and IndexedDB queues. Diagnostics explicitly persist under `klar:user:<uid>:klar_sync_logs`, filter by owner, and have bounded retention (100 per owner persisted, 1000 total in memory). Code commits `f26769c1887de35c9112785457e5617d6c8d2d87`, `dc712c9ec8c68d6bd40039ee7dbc85c4352e2f7b`, `c1a46797e51f2857b04e5b44e72be51f6e92c69b`, `c7599c4a855b0ef6246b464e342c5f841b763683`.

**Tests:** Updated legacy enterprise tests and added 4 multi-account cases to regular Vitest suite `tests/legacyOfflineQueueIsolation.spec.ts` (commit `f47c8ba86ae9e1af2f34d1036667e42f14ab72a1`). Added predependency static regression `scripts/legacy-queue-isolation.test.mjs` and wired into CI/preflight (commits `38b8d44dc7d4c3ccb18161450d40162e8aade16b`, `ef33e42187e6848e4e5ddcfdfc55792f647a5ab0`, `9da56f211717ec1ca45fc922d312613ad82a0c7a`). **Actual checks:** Direct inspection of current GitHub sources verified 9/9 invariants (source blob `595b3af84c304e9d4d1c3dabb70f372c6370a246`, AuthContext blob `dc8b14ad493ea2cd34dca090d5ba265f9a8c0bb7`). The six? legacy Node/Vitest suites and full pinned Node 22.23.3/Bun 1.4.2/Java21 system tests were **NOT RUN**; test assertions being committed alone do not constitute a passing test run.

**Boundary:** OwnerUid is client-supplied and cannot authenticate itself. Production endpoint must verify Firebase ID token and chat ownership. Explicit token-string presence alone does **not** bind token subject to the UID: server-side verification, auth transition handling, concurrent logout and multi-account browser e2e remain required.

**Release:** frozen R2 unchanged; no Actions minutes, merge, deployment, GCP evidence or human approval. **NO-GO**.


## 2026-10-10 — Verified chat sender boundary and session-cancelable offline replay

**Server authority confirmed, not guessed:** `requireAuth` in `server.ts` calls `verifyIdToken(idToken, true)`, stores decoded identity in `req.user`, then protects `createChatRouter`. `handleSendMessage` takes its actual sender UID only from that decoded request user. Membership/gate/block/deletion state is checked via `readChatAccess` before safety evaluation and inside the Firestore write transaction. Additional fail-closed `403 sender_mismatch` now rejects conflicting client-supplied `uid`, `ownerUid`, `senderId` (code `bd4077c64f46b1fd14af06bcbe46dcdd69797bd0`); emulator regressions `4e54005c4d8a012a1e4b14b0a0f032da0b065843`.

**Client side account-switch race remediated:** `flushOfflineQueue` now accepts an abort signal and session-identity predicate and stops work upon cancellation, without modifying retry/dead-letter state (code `985c5b6dc529cf82b1dff53a17a9187b1a09771d`). `SyncBanner` cancels replay on identity change/offline/unmount, deduplicates concurrent triggers and catches asynchronous errors (code `a7893f5262f24dec7e2e658b1c92f5e9baca7541`, `b2bc8b582cfceea4561ad9b353f975c9f352a2f0`). Logout dispatches a replay-cancel signal **before** waiting for server token revocation; the previous user's replay remains paused until auth identity changes (code `8770c252db435b48b63c1c558da579f4e77cac04`, `2cb4a2409e0f25bf8330887e13ae2363907ba4c6`).

**Regression files committed:** Four regular-Vitest cancellation cases `tests/offlineReplayCancellation.spec.ts`, commit `91e806f702a74533744847e9ffb3ea57ea7f957b`; additional Firebase emulator scenarios in `tests/chatPersistence.spec.ts`, commit `4e54005c4d8a012a1e4b14b0a0f032da0b065843`; four Node-source invariants in `scripts/offline-replay-auth.test.mjs`, commit `a16a6486f29204ee1c3fd4613c8e8ed3d4683801`, integrated into full-scope CI and local preflight (`8a2d5830fa441d2f4c3310efcfd2a838fd5ed67d`, `754384785c4973507bd84f12f6a0ba43b10c77fe`).

**Actually verified:** Retrieved current GitHub source blobs, tested **13/13** security assertions against exact source text. **Not run:** newly committed Vitest/UI/Firebase tests, full pinned Node 22.23.3/Bun 1.4.2/Java21 TS/Emulator/Playwright pipeline, real authorization/notification in production. Cancellation is best effort: an HTTP request already accepted by the server before logout may complete, so server token revocation and chat authority remain mandatory. No live cloud access, CI run, merge or deploy, and frozen R2 unchanged. Official **NO-GO**.


## 2026-10-10 — Offline recovery without idle polling; cumulative dead-letter evidence

**Confirmed functional gaps:** With connectivity continuously online, pending IndexedDB messages that failed once could stay queued until another unrelated online/auth event. `flushOfflineQueue.deadLettered` previously counted only newly dead-lettered messages from a given call, so an unresolved delivery warning could disappear after any subsequent sync attempt.

**Development-branch fixes:** `SyncBanner.tsx` now uses one account-bound 60-second timer only while `result.remaining > 0` and online, respecting the existing maximum 60-second per-message retry backoff. It cancels pending timers on connection changes, logout-start events, auth transitions and unmount. Commit `ba257001b37e94692a6fd1f740e71c321827473f`. `offlineQueue.ts` now reports the total currently stored owner-scoped `dead_letter` count and pending count from the same indexed read. Commit `6a98f2fd406fbe1819f78baa595f8146e89ad6f2`.

**Test contracts:** New early `scripts/offline-retry-scheduler.test.mjs`, commits `bc707212fa0f47aaf20c63235a59922e5e2806ca`, `5af7e1c5dde27b69bc00a633cbc7770acaf0bd65`; hooked into CI and local preflight, commits `38ebbca03768b873d0475457b110bd97202c93af` and `ef1037066d85667b94327e4a67f998bb5bae0361`. Two new regular Vitest tests for existing dead letters, commit `e848f4b0669fb3ec2bf4dd6ae214cf03d92a78fd`.

**Evidence:** Fetched current original GitHub files: `SyncBanner.tsx` blob `1ffaef8a252436e12bc75444dd331f706a9e8409`, `offlineQueue.ts` blob `518396ed479460895353b506f87e8955da3db3b1`; **14 of 14 direct source assertions passed**, including retry only when pending, 60-second bound, cancellation on auth/offline/unmount, cumulative dead-letter count and CI registration. **Not executed:** the newly committed Node/Vitest cases against full checkout or the pinned Node 22.23.3/Bun 1.4.2/Java 21 CI suite; no browser/Firebase/Playwright or production endpoint tests. No measured TCO savings. Frozen R2 unchanged, no manually triggered Actions/merge/deployment. **NO-GO**.
