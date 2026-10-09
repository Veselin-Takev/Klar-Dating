# Post-merge validation and dependency triage — 2026-10-09

### 2026-10-09 — PR #6 exact-candidate remote validation passed

The owner authorized one bounded remote validation exception for the prepared post-merge correction. [PR #6](https://github.com/Veselin-Takev/Klar-Dating/pull/6), candidate `efd5016e1c48ef08cfeaae283423f6ccdfcaf9d0`, passed [CI #337](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/37965468398), job `113938603278`.

**SUCCESS:** Enterprise gates (including Node/Docker 22.23.3 alignment), all TypeScript projects, Functions build, **157 test files / 1,003 tests**, application build, production smoke and **26 browser tests** passed. The corrected registered-account onboarding journey passed with exact music-preference export assertions before and after reload. Test orchestration exited 0. This is passing evidence for this candidate/run, not a claim that repeated-run stability or production readiness is universally proven.

Job interval: 2026-10-09 17:19:42–17:30:02 UTC, **10m 20s**, rounded conservatively to **11 minutes**. Previous ledger 61 + 11 = **72 additional minutes consumed; 128 of 200 remain**. The 45-minute reservation is released. Billing remains authoritative; no second run was triggered for this result.

PR #6 is conflict-free and GitHub reports `clean` at this snapshot. It has not been merged or deployed by this work. Phase 3 documentation is included in the PR; actual training, pilot measurements, organizational approvals and remaining operational/audit evidence are still open. **Production: NO-GO / NOT CONFIRMED.** This evidence is saved on a separate non-PR documentation branch to avoid another CI trigger.

## Confirmed observations

Main commit `b9808179d26cd4bb21644c4d8f871a439ea09157` failed [CI 37963077381](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/37963077381) in Browser acceptance: the registered-account onboarding export expected music preferences but received `undefined`. The earlier PR candidate passed all 26 browser tests. The new result supersedes any assumption that the merged state is consistently green; it does not negate the historical passing run.

Source review found that the browser test requested the export immediately after clicking the submit button. Playwright's click does not await the asynchronous React handler. The application awaits the Firestore write, pending writes and an authoritative profile read before marking onboarding complete. The test therefore had no ordering guarantee between persistence and export. This is a concrete test race; the exact failure has not been replayed with Chromium locally because the documented browser environment limitation remains.

## Candidate changes and local evidence

- Wait for application navigation after submission before requesting the export. Keep exact assertions for all music fields and add another export assertion after reload. No arbitrary sleep, retries, weakened assertions or client-storage shortcut.
- Exercise the real onboarding component with a deferred completion promise, duplicate-click attempt, rejection and retry; verify that selected preferences survive.
- Wire the already-existing runtime Node/Docker alignment check into `check:enterprise`. It was present but not executed by that gate chain. Node remains 22.23.3.
- Local targeted regression: three files / eight tests passed. Enterprise static gates passed. A temporary isolated fixture verified that the existing gate accepts the approved image and rejects Node 26.
- All three TypeScript projects passed on the corrected candidate. No new remote workflow was started for this work. The amended browser test still requires a suitable local browser or an explicitly authorized remote validation before it can be recorded as passing.

## Dependency PR decisions

| PR | Observed result | Cause / decision |
|---|---|---|
| [#2](https://github.com/Veselin-Takev/Klar-Dating/pull/2) Functions | Functions build failed | Upgrades TypeScript 5.8.3 to 7.0.2 and Node types 22 to 26. Compiler rejects legacy moduleResolution and requires explicit rootDir. Treat as a separate compiler migration; retain current pins in this candidate. |
| [#3](https://github.com/Veselin-Takev/Klar-Dating/pull/3) Actions cache | CI passed | Green tests alone do not complete action version/permissions/runner compatibility review. Not merged by this work. |
| [#4](https://github.com/Veselin-Takev/Klar-Dating/pull/4) Docker Node | CI passed | Proposes Node 26.10.0, contrary to the required 22.23.3 baseline. Not accepted; newly wired alignment gate closes the validation gap. |
| [#5](https://github.com/Veselin-Takev/Klar-Dating/pull/5) Bun group | Enterprise static gates failed | Proposes TypeScript ~7.0.2; compiler-API consumer kiErsatzPruefung.mjs fails at ScriptTarget.Latest. Requires explicit compiler/API migration and review of the other grouped updates; retain existing graph. |

No dependency PR was merged, closed, force-pushed or rerun. No vulnerability assessment for all proposed dependencies is claimed. The existing pinned versions are retained for stability, not certified vulnerability-free. Major runtime/compiler migrations need separate compatibility evidence rather than removing protective gates.

## Conservative incremental runtime ledger

Measured from the first authorized additional-budget validation (#331). Every completed job is rounded up individually. All observed jobs, including Dependabot update generation, are counted here conservatively; GitHub billing may classify them differently. These are runtime estimates, not billing exports.

| Run ID | Purpose | Rounded job minutes |
|---|---|---:|
| 37961300244 | approved PR validation #331 | 9 |
| 37963077381 | main push after user merge | 10 |
| 37963272986 | Functions dependency PR | 3 |
| 37963282103 | Actions dependency PR | 14 |
| 37963414112 | Docker dependency PR | 11 |
| 37963616587 | Bun dependency PR | 2 |
| 37963096261 | Dependabot Docker update generation | 3 |
| 37963095746 | Dependabot Functions update generation | 2 |
| 37963092377 | Dependabot Bun update generation | 5 |
| 37963092212 | Dependabot Actions update generation | 2 |
| **Total** | **All ten observed runs completed** | **61** |

Conservative remaining allowance: **139 of the additional 200 minutes**, at this snapshot. Enterprise CI validation alone accounts for 49 rounded minutes; 12 more were conservatively attributed to update-generation jobs. New runs require a fresh inventory. No active job reservation remains in this snapshot; any newly authorized validation must reserve its full 45-minute cap before start. No automatic rerun is authorized by this document.

## Release and next gate

Production remains NO-GO / NOT CONFIRMED. Candidate changes and Phase 3 materials are prepared on a non-PR branch. Opening a PR or pushing main may trigger CI, so neither is done silently. Next technical gate is the amended browser test plus full candidate validation in a suitable environment. Phase 3 organizational owners, actual pilot, restore/load/deletion evidence and independent release approvals remain open.
