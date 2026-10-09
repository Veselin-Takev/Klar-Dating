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

The local changes have not been validated by a new GitHub workflow. Cache restore
and upload behavior require the first authorized remote run. Selective checks must
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
- Additional Actions consumption during this work: **0 minutes**. Work is saved on
  a separate branch without a pull request; the existing PR branch is unchanged.

The local prerequisite for a remote run remains incomplete. Do not silently
substitute the above checks for browser acceptance or official release approval.
