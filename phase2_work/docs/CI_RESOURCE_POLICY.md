# Local validation and Actions resource policy

## Authorization and release boundary

On 2026-10-09 the owner authorized up to **200 additional GitHub Actions minutes**,
with extremely economical use and thorough local validation before triggering remote workflows.
This is an incremental budget, not a reset of historical consumption.
Do not push a candidate that starts CI until its local gates pass. A local PASS is
not an official production approval. Production remains **NO-GO / NOT CONFIRMED**.

## Local entry point

Use Node **22.23.3**, Bun **1.4.2**, Java **21** and the browser revision supplied
by the committed Playwright dependency. Install Chromium with
`bunx playwright install --with-deps chromium`, then run `bun run verify:local`
inside `phase2_work/`.

The preflight installs both frozen dependency graphs, tests the CI scope classifier,
runs Enterprise gates, all three TypeScript projects, Functions build, unit/rules
and emulator tests, application build, production smoke and browser acceptance.
It stops on failure and does not publish, push, deploy or approve a release.
Browser/server reuse is disabled by `CI=true` for reproducible acceptance tests.
The server uses `node --import=tsx` rather than the tsx CLI's extra IPC listener.

## Remote workflow optimizations

- Commit the locally reconciled Bun lockfile. CI uses `bun ci`; it never repairs
  the lockfile or resolves a new graph during validation.
- Cache npm package downloads by the Functions lockfile and Bun/emulator downloads
  by OS, architecture, Bun/Java versions and the application lockfile.
  Never cache credentials, emulator user data or node_modules.
- Defer Java setup until static gates and typecheck pass.
- Keep the required `validate` job present. Only a narrow allowlist of narrative
  documents can omit application validation on a PR. Unknown paths, mixed changes,
  missing diff information, workflow/rules/code changes and main pushes get full
  validation. A PR diff is compared against its base, not just the last commit.
- Retain failure diagnostics for seven days. Avoid per-run lockfile artifacts now
  that the resolved graph is committed.
- Bundle fixes, tests and documentation in one push. Do not start speculative
  remote runs or repeatedly cancel in-progress installs with follow-up commits.
- Keep concurrency cancellation for genuinely superseded candidates. It does not
  recover already consumed runner time.

## Budget accounting

Before each remote-triggering push, record the current run/job IDs, account for
all attempts and active jobs, and reserve the workflow's maximum 45-minute runtime.
Use rounded job runtime as a conservative local ledger; GitHub billing remains
authoritative. Do not infer exact billed usage from workflow elapsed time.
Stop before the additional 200-minute allowance could be exceeded.

## Evidence limits

The owner explicitly approved one bounded remote validation exception after the
local browser/environment limitations were disclosed. CI #331 validates candidate
`0042bbff95e2092c804407fd8559aa6d8e3d37ed`; its final result is recorded below. Selective checks must
not be used as release evidence for a changed application candidate.

## Local results on 2026-10-09

- Application suite: 155 files, 999 tests passed (Vitest child exit 0).
- Final focused regression: seven files, 32 tests passed, including partner,
  consent, account erasure, pagination and database shutdown (Vitest child exit 0).
- All three TypeScript projects, Enterprise gates, naming/label checks,
  Functions build and production application build passed.
- Frozen Bun install and three scope-classifier tests passed.
- Production smoke, including unforced successful process shutdown, exited 0.
- The concurrently/emulator orchestration remained active after the successful
  Vitest child exited and was interrupted locally. Therefore `test:ci` as a whole
  is **not** recorded as a clean exit-0 run in this environment. The pending
  orchestration shutdown needs verification in the next suitable environment.
- Browser acceptance did not run: pinned Chromium download returned an unavailable
  HTML page; installed Chrome 153.0.8010.36 failed to create a required local socket
  (`EPERM`). No browser security/sandbox restriction was disabled.
- Additional Actions consumption during the local preparation: **0 minutes**.
  Following explicit owner approval, the prepared commit was promoted to PR #1
  and triggered exactly one remote run (#331); no rerun was requested.

The owner-approved exception applies only to this one remote run, with a
45-minute job limit. It does not authorize automatic reruns or production release.

## Authorized remote result and incremental ledger

### 2026-10-09 — Authorized remote validation passed (CI #331)

The owner explicitly approved one remote validation exception after disclosure of the local browser and process-orchestration limitations. PR #1 was fast-forwarded to candidate `0042bbff95e2092c804407fd8559aa6d8e3d37ed` and exactly one workflow ran: [CI #331](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/37961300244), job `113924515032`.

**Result: SUCCESS.** Scope regression tests, frozen dependency installation, Enterprise static gates, all TypeScript projects, Functions build, application tests (**156 files / 1,001 tests**), application build, production smoke and Chromium browser acceptance (**26 / 26 passed**) all passed. The test orchestration exited successfully (code 0); the earlier local parent-process limitation did not reproduce on this runner. npm and Bun/emulator download caches were saved successfully; a future cache-hit speedup has not yet been measured.

Runner job: 2026-10-09 16:44:39–16:53:30 UTC (**8m 51s**). Conservative incremental ledger: **9 of 200 additional minutes consumed; 191 remain**, subject to GitHub's authoritative billing. The unused 45-minute reservation is released. No rerun, merge, release tag or deployment was initiated.

This closes the previously failing browser-regression gate for this candidate, including FE-01, FE-02 and FE-03 acceptance evidence. It does not certify every audit finding as resolved: deletion/retention completeness, production load/cost evidence, restore-drill evidence and independent operational/governance approvals still require their own exit criteria. **Official production approval remains NO-GO / NOT CONFIRMED.**

This evidence update is retained on a separate documentation branch without a pull request so it does not trigger a second Actions run. PR #1 remains on the successfully validated candidate above.

## Superseding post-merge snapshot

See [post-merge runtime ledger](POST_MERGE_VALIDATION_2026-10-09.md): all ten observed runs completed; conservative cumulative incremental usage is **61 minutes**, with **139 remaining**. The earlier 9/191 ledger is historical, before the user merge and dependency runs. No candidate rerun has been started.

## 2026-10-10 — Runtime preflight candidate

CI and tag releases now perform the dependency-free runtime check before setup and installation. Six runtime/scope regressions and targeted structural gates passed under Node 24.19.0. Full local validation under Node 22.23.3 remains pending. No Actions run was initiated. See AUDIT_REMEDIATION_2026-10-10.md; older budget balances above remain historical snapshots.


## 2026-10-10 — Superseding 100-minute cap and isolated LLM CI optimization

**Current owner instruction supersedes the historical 200-minute allowance:** no more than **100 incremental GitHub Actions minutes** may be consumed under this authorization. Stop at the cap; obtain **explicit authorization** before using any additional 200 minutes. Historical figures above are not a current billing balance. Do not initiate remote jobs if remaining authorized capacity cannot be established conservatively.

**Implemented on isolated candidate branch** `ci/optimize-llm-evaluation-frozen-install-2026-10-10`:
- In the manually triggered LLM security-evaluation workflow, eliminate the redundant `bun install --lockfile-only` (which could resolve/rewrite the dependency graph); use the committed frozen lockfile via `bun ci` and a post-install clean-lockfile assertion.
- Add a lock-integrity preflight and a pinned Bun download cache keyed by OS, architecture, Bun version and `bun.lock`. Do not cache `node_modules`, credentials or evaluation output.
- Preserve manual opt-in, workflow permissions, action SHA pinning and the 30-minute job timeout.
- **No expansion of path skipping:** PR validation still fails closed for every path except the existing documented narrative allowlist; pushes to main always run full gates for exact-SHA release evidence.
- Local validation: workflow YAML parsed and nine structural/guardrail assertions passed in an isolated workspace. The available local Node interpreter is 22.16.0 (not required 22.23.3); dependencies, emulator and browser suite were not available here. **Not a full local acceptance PASS.** Consequently no PR, push to main, Actions run, release or deployment has been initiated.

Next: run `bun run verify:local` on an approved Node 22.23.3 / Bun 1.4.2 / Java 21 environment, then review the isolated workflow diff and commit SHA. Before any CI-triggering promotion, check account billing and reserve runner minutes within the new 100-minute allowance. Production remains NO-GO.


## 2026-10-10 — Measurable local release preflight

The existing `verify:local` entry point now records **each stage duration, exit status, and failure point** in a local JSON report. By default it writes to the OS temporary directory (`klar-local-preflight-<pid>.json`); operators can set `KLAR_LOCAL_PREFLIGHT_REPORT` to an approved private path. The file is created with permission mode `0600` where supported. No environment-variable values, command output or credentials are copied into the report. The report documents results only; it does not approve a production release.

The runner fails closed on missing/wrong Node 22.23.3, Bun 1.4.2 or Java 21; runs frozen installations, the scope classifier, runtime-alignment gate, Enterprise static controls, all TypeScript projects, Functions, emulator tests, build, production smoke and browser acceptance. On failed stages it records `FAIL`, stops, and exits nonzero. The generated report can identify expensive local stages without consuming GitHub Actions minutes. It must not be considered a substitute for required exact-commit CI or cloud operational evidence.

**Verification performed:** nine dependency-free structural assertions passed on the fetched candidate script and the manually triggered LLM workflow. These assertions are **not** an actual local application suite, browser suite or pinned-toolchain execution. Complete local acceptance remains `PENDING`; accordingly no PR / main push / remote CI was triggered.

Next measured optimization: compare local per-stage durations with Actions job timings before selecting any further cache or path-filter changes. Continue to reserve remote minutes under the owner's latest **100-minute** limit.


## 2026-10-10 — Measured CI bottlenecks and offline duration analysis

[Successful main CI run 38036361126](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/38036361126), job `114167501415`, completed 2026-10-10 08:00–08:10 UTC. Step durations read from GitHub job metadata (rounded to whole seconds): tests/emulators **258 s**, browser acceptance **148 s**, dependency installation **101 s**, typecheck **59 s**, Chromium installation **23 s**, production smoke **16 s**, cache restore **10 s**. These are step wall-clock durations, **not billable-minutes accounting**; they may vary between runs. Focus future improvements on repeatable local reproduction and measured bottlenecks, not disabling required security and browser gates.

New zero-dependency read-only command to analyze a previously downloaded GitHub Actions job JSON payload locally:

```sh
node --test scripts/analyze-ci-duration.test.mjs
node scripts/analyze-ci-duration.mjs /private/path/to/github-jobs.json
```

The analyzer reads the `jobs` array with `steps` returned by GitHub's workflow-run jobs REST endpoint, prints the 12 slowest steps and status, and never launches CI or publishes input data. Do not commit raw job JSON, because it may contain sensitive metadata. Unit tests include duration ordering, malformed timestamps and dropping unrelated sensitive fields. **Local evidence:** 3 isolated node:test checks passed and `node --check` succeeded in the available local interpreter. This does not certify full project acceptance under pinned Node 22.23.3; `verify:local` remains required before PR or merge.

No remote workflow was initiated for these analytical changes. The **100-minute incremental cap** remains in force, with billing reconciliation required before further remote actions. Production status: **NO-GO**.


## 2026-10-10 — Emulator-suite profiling without weakening isolation

The full CI job's `Tests` step took 258 seconds in [run 38036361126](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/38036361126). This is the duration of the *whole* test orchestration, not proven emulator startup time. The current `vitest.config.ts` deliberately configures `fileParallelism: false`: rule suites reset a shared emulator database and must not race against persistence/security tests. **Do not enable parallel Vitest files or share mutable emulator state merely to save minutes.**

Added a read-only, dependency-free Vitest JSON suite profiler and unit tests:
```sh
node --test scripts/analyze-vitest-duration.test.mjs
node scripts/analyze-vitest-duration.mjs /private/path/to/vitest-report.json
```
To produce the input on an isolated local environment, run Vitest with its JSON reporter under the same Auth/Firestore/Storage emulator conditions as `test:ci`. Preserve test coverage, test-run exit status, and the JSON file privately; do not commit raw test reports. The profiler reports the 15 slowest suites and explicitly distinguishes summed suite times from wall-clock time or billable runner minutes.

**Evidence:** Syntax check and all three unit tests passed locally with Node 22.16.0. No full pinned Node 22.23.3, Java/Firebase emulator or browser run was performed here. No PR, main push, Actions run or deployment was initiated. Continue the latest 100-minute cap and NO-GO status. Only propose isolated test-performance changes after profiling real suite timings and demonstrating unchanged correctness.


## 2026-10-10 — Verified Vitest reporter contract and safe profiling command

Vitest's documented `json` reporter emits Jest-compatible `testResults[]` entries with `name`, `startTime`, `endTime`, `status` and `assertionResults`. The profiler supports these fields; its regression suite now includes an official-shape fixture and verifies that failure messages and assertion bodies are not passed into the summary.

Recommended **isolated local** profiling invocation inside the existing Auth/Firestore/Storage emulators (not alongside a concurrently running test suite):

```sh
# From phase2_work/ after frozen install; use only the approved local test environment:
firebase emulators:exec --project demo-klar --only auth,firestore,storage \
  'bunx vitest run --reporter=default --reporter=json --outputFile=/private/approved/path/vitest-report.json'
node scripts/analyze-vitest-duration.mjs /private/approved/path/vitest-report.json
```

Keep the original test process exit status as the authoritative result; profiler output never promotes a failed test run to PASS. Use a private absolute report path (the example is illustrative), and do not commit raw test results. Do not modify `fileParallelism: false` until database-isolated concurrent tests are proven. The complete required `bun run verify:local` remains a separate prerequisite for remote promotion.

**Validation distinction:** the documented reporter shape was checked against the official Vitest reporter documentation; a regression fixture was added to the candidate. Full local test execution was not performed in the available environment and remains pending. No Actions run requested; 100-minute authorization cap unchanged. Production remains NO-GO.


## 2026-10-10 — Fail-closed Vitest report hardening

The offline `analyze-vitest-duration.mjs` profiler now rejects missing global success flags, invalid reported test counts, malformed suite objects, unrecognized suite statuses, and inconsistent/truncated test totals. Its JSON summary includes an explicit `overallStatus`; the CLI exits nonzero for a failing test run. This is important: a performance-profile generation must **never** be presented as passing test evidence when Vitest failed.

Regression fixtures have been extended for truncated/malformed input, contradictory status and privacy-safe failure data. **Implementation committed to the isolated candidate branch; full pinned-toolchain execution remains PENDING.** No claim of full local acceptance or official release approval is made. No Actions workflow was intentionally triggered. GitHub Actions limit remains 100 newly authorized minutes subject to actual billing reconciliation; production remains NO-GO.


## 2026-10-10 — Additional local reporter hardening

Fixed an overlooked contradiction: a Vitest JSON report could previously declare global `success: true` while also reporting `numFailedTests > 0`. The suite profiler now rejects this combination and rejects negative or out-of-range failure counts (if present). The dedicated regression case passed locally under Node 22.16.0 using a matching isolated code fixture (4/4 local checks), along with the JavaScript syntax check. The full checked-out repository suite, Bun 1.4.2 and pinned Node 22.23.3 are **not** available in this environment; the full branch was not locally certified. These targeted checks do not override `verify:local` or production approvals.

No CI run or deployment was started; the 100-minute incremental Actions limit and NO-GO release hold remain active.


## 2026-10-10 — Test-evidence privacy and false PASS hardening

An additional review found that Vitest profiler summaries disclosed absolute test-suite workspace paths, potentially containing a developer name or host-specific directory. The summary now emits only normalized suite basenames for both POSIX and Windows-style paths. Test report input remains private and is never committed. The profiler additionally rejects reports declaring overall success when any assertion status is not `passed`.

Changes: `scripts/analyze-vitest-duration.mjs` and accompanying privacy/contradiction regressions. A targeted **local Node 22.16.0 path-normalization smoke test** passed for POSIX and Windows paths. A full test execution of the exact repository branch under required Node 22.23.3 / Bun 1.4.2 / Java 21 **has not been performed**, so release validation remains `PENDING`. No GitHub Actions runs, deployment or production approval were initiated. Keep the 100-minute incremental Actions cap and NO-GO decision.


## 2026-10-10 — Fail-fast local diagnostics integration

The local `bun run verify:local` preflight now executes `node --test scripts/analyze-ci-duration.test.mjs scripts/analyze-vitest-duration.test.mjs` **before dependency installations**. A regression failure therefore blocks further setup and produces an explicit failed stage in the private preflight JSON report, avoiding unnecessary installs and potentially expensive emulator/browser stages. Existing exact runtime checks and every production-relevant test step remain intact; no tests were removed or bypassed.

**Evidence and limitation:** Verified the candidate source updates and repository paths through GitHub; the available isolated runtime reports Node v22.16.0 and cannot access the private GitHub repository from the local container. Therefore the exact fetched files could not be run locally from a full checkout here. This is **not** a local test PASS, and the full pinned Node 22.23.3/Bun 1.4.2/Java 21 `verify:local` remains mandatory. No remote GitHub Actions jobs were started. The current 100-minute limit and production NO-GO hold remain unchanged.


## 2026-10-10 — Executed local diagnostic smoke tests, with provenance boundary

Local working copies of the standalone diagnostics were executed with installed Node **v22.16.0** (not the required production toolchain Node v22.23.3):
- `/mnt/data/klar-ci/scripts/*.test.mjs`: **3 passed, 0 failed** (CI duration analysis).
- `/mnt/data/klar-ci-diagnostics/*.test.mjs`: **4 passed, 0 failed** (Vitest suite-duration analysis).
- Both processes returned exit code 0.

**Provenance caveat:** These were local working copies, *not* a verified materialization of the exact latest GitHub branch SHA. The repository version has more recent regression cases than the local four-test Vitest copy. Therefore these results are **diagnostic smoke evidence only**, not certification of current candidate correctness. No emulator, Playwright, complete repository, frozen Bun dependency installation or tagged release verification was executed. Preserve the mandatory `bun run verify:local` gate and verify exact working-tree SHA before promoting a branch.

The local environment has Java 21, Node v22.16.0, and no working Bun command. Do not publish or initiate GitHub Actions merely to replace missing local validation. No additional workflow run was initiated; 100-minute cap and production **NO-GO** remain unchanged.


## 2026-10-10 — Fail-closed Actions step timing validation

Found and corrected a reporting integrity defect: the read-only Actions duration analyzer silently omitted any step missing one or both timestamps. It now rejects partially timestamped steps and non-skipped steps missing all timestamps, ignores legitimately skipped steps without execution times, and rejects entirely empty measurements. This prevents incomplete timing evidence from appearing complete.

**Executed local evidence:** the standalone Actions timing analyzer and its regression test were updated in an isolated local copy and run under available Node **22.16.0**. `node --check` succeeded and `node --test scripts/analyze-ci-duration.test.mjs` returned **4 passed / 0 failed** (process exit 0), including the new missing-timestamps regressions. The updated local script matches the replacement logic committed on the candidate branch, but this does **not** certify a complete local checkout or the mandated Node 22.23.3/Bun 1.4.2/Java 21 application suite. The exact-code branch-wide `verify:local` remains PENDING.

No Actions run or production deployment was initiated; the new 100-minute authorization limit remains intact and the release stays **NO-GO**.


## 2026-10-10 — Exact-commit local evidence gate

The candidate `verify:local` preflight now checks `git rev-parse --verify HEAD` against a full 40-character SHA and requires `git status --porcelain --untracked-files=normal` to be empty before any installation or application validation. The result JSON records `gitSha`; dirty, untracked or invalid Git state blocks the preflight. This makes test evidence attributable to a specific checkout instead of an unspecified working copy. The dependency-free provenance gate regression is executed early alongside the diagnostic tests.

**Local evidence:** the exact standalone module and its four regression fixtures were exercised on Node v22.16.0 in an isolated temporary directory: **4 PASS / 0 FAIL**, and JavaScript syntax validation passed. The full GitHub repository checkout, required Node v22.23.3 / Bun v1.4.2 suite, emulator integration and browser acceptance have **not** been executed here; those gates remain PENDING. Note: the clean-checkout guard may require removing generated/untracked build reports before a new validation attempt, without discarding any user data. This is not a production approval.

No new GitHub Actions run, merge, tag or deployment was triggered. Enforce the owner's **100 additional Actions minutes maximum**; verify actual consumption before any remote run and ask for explicit authorization prior to an additional 200 minutes. Production: **NO-GO**.


## 2026-10-10 — Repository-root provenance hardening

The local preflight Git provenance verifier now additionally resolves `git rev-parse --show-toplevel` and requires that its canonical filesystem location equal the expected repository root. This prevents test evidence from being attributed to an accidental parent or unrelated Git checkout. It also resolves `HEAD^{commit}` rather than trusting ambiguous symbolic output. A clean tracked/untracked working tree remains mandatory.

**Executed local evidence:** exact updated verifier and six companion regression tests executed using Node v22.16.0 in an isolated local directory. Results: **6 passed, 0 failed**; `node --check` passed. Covered clean root, unexpected root, modified and untracked files, invalid commit identity, command failure and symlink-canonical paths. This is targeted component evidence only; a full `verify:local` under required Node 22.23.3 / Bun 1.4.2 / Java 21 remains **PENDING**. The candidate remains unmerged.

No GitHub Actions workflow, release or production deployment was started. Respect the current 100-minute incremental Actions cap and preserve **NO-GO** until the complete operational release checklist has been evidenced and explicitly approved.


## 2026-10-10 — Closing the provenance time-of-check/time-of-use gap

Review identified that the earlier `verify:local` runner only checked the exact clean Git HEAD **before** frozen installs, tests and build. If a stage modified a tracked file, created an untracked file, or HEAD changed while the tests ran, the JSON report could still claim PASS for the starting commit. The candidate preflight now repeats the repository-root and clean-working-tree verification **after browser acceptance**, compares the final 40-character commit SHA with the initially recorded `report.gitSha`, and fails closed on differences before assigning `report.status = 'PASS'`.

This is a source-level correction committed to the isolated candidate branch; full end-to-end validation under pinned Node 22.23.3, Bun 1.4.2, Java 21 and the current exact branch remains **PENDING**. Do not promote or merge on the basis of source review alone. Intentionally generated reports must be ignored or written outside the checkout; the final cleanliness check must not be bypassed. No CI run or deployment triggered; authorized incremental Actions cap remains 100 minutes and release remains **NO-GO**.


## 2026-10-10 — Guard against self-invalidating local evidence

Review of the final Git cleanliness gate found an edge case: `KLAR_LOCAL_PREFLIGHT_REPORT` could point inside the checkout. A newly written JSON evidence file would then dirty the repository **after** the final clean-SHA check, making the recorded PASS non-reproducible. The preflight now requires the report's canonical parent directory to be outside the Git repository, including when parent directories are symlinks. The target parent directory must already exist. Evidence is written exclusively with `flag: 'wx'` and owner-only `0600` permissions, preventing accidental overwrites and symlink-based replacement. For custom destinations use a unique fresh path in an existing private directory outside the checkout.

**Validation:** this is an isolated, source-reviewed change on the unmerged candidate branch; the full pinned local application test suite and exact-commit check are still PENDING. Do not count static source review as successful end-to-end evidence. GitHub Actions consumption caused by this work: zero new runs. Retain the 100-minute incremental cap and release **NO-GO**.


## 2026-10-10 — Report path guard regression evidence

The inline preflight report path check is extracted to `scripts/report-path.mjs` and validated by `scripts/report-path.test.mjs`. It requires an existing external parent directory outside the canonical repository root; rejects symlinked directories pointing back into the repository; and rejects an existing target (including dangling symlinks) before starting expensive tests. The preflight runs these unit tests in its early diagnostics gate and checks the path again before exclusive, mode-0600 report creation (`wx`). Operators should use a unique fresh filename outside the checkout, preferably in a private directory.

**Executed evidence:** the six exact standalone regression fixtures were run locally under Node v22.16.0: **6 PASS, 0 FAIL**. This is *not* the pinned Node v22.23.3/Bun v1.4.2/Java 21 whole-project acceptance. The race between the preflight check and output creation is covered by exclusive `wx`, which rejects newly occupied targets. CI usage from this change: zero new runs. The unmerged candidate and production release remain **NO-GO**.


## 2026-10-10 — Exact Git-blob validation for report path controls

Re-ran `node --test /mnt/data/klar-report-guard/*.test.mjs` with local Node v22.16.0: **6 passed, 0 failed** (TAP, exit 0). Unlike earlier smoke tests, the executed module and test fixture were verified byte-for-byte against the **current candidate branch** via `git hash-object` and the GitHub file blob SHAs:

- `scripts/report-path.mjs`: `996ae47d5a78a24bdfcb01a9c40a86b92cf0009c`
- `scripts/report-path.test.mjs`: `87670c14ae2c71b25d8a4605107a6bc7505e3944`

These exact candidate files passed six regression cases. This establishes **component-specific exact-file evidence**, not a successful whole-branch `verify:local`. Runtime still differs from pinned Node 22.23.3 and Bun 1.4.2 is unavailable; no emulator, browser, or full clean-checkout integration pass has been demonstrated. No Actions runs were initiated; the 100-minute incremental cap and release **NO-GO** remain in effect.
