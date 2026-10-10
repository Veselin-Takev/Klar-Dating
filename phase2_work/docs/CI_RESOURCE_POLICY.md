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
