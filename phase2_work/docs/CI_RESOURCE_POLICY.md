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

## Latest authorized result — CI #337

### 2026-10-09 — PR #6 exact-candidate remote validation passed

The owner authorized one bounded remote validation exception for the prepared post-merge correction. [PR #6](https://github.com/Veselin-Takev/Klar-Dating/pull/6), candidate `efd5016e1c48ef08cfeaae283423f6ccdfcaf9d0`, passed [CI #337](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/37965468398), job `113938603278`.

**SUCCESS:** Enterprise gates (including Node/Docker 22.23.3 alignment), all TypeScript projects, Functions build, **157 test files / 1,003 tests**, application build, production smoke and **26 browser tests** passed. The corrected registered-account onboarding journey passed with exact music-preference export assertions before and after reload. Test orchestration exited 0. This is passing evidence for this candidate/run, not a claim that repeated-run stability or production readiness is universally proven.

Job interval: 2026-10-09 17:19:42–17:30:02 UTC, **10m 20s**, rounded conservatively to **11 minutes**. Previous ledger 61 + 11 = **72 additional minutes consumed; 128 of 200 remain**. The 45-minute reservation is released. Billing remains authoritative; no second run was triggered for this result.

PR #6 is conflict-free and GitHub reports `clean` at this snapshot. It has not been merged or deployed by this work. Phase 3 documentation is included in the PR; actual training, pilot measurements, organizational approvals and remaining operational/audit evidence are still open. **Production: NO-GO / NOT CONFIRMED.** This evidence is saved on a separate non-PR documentation branch to avoid another CI trigger.
