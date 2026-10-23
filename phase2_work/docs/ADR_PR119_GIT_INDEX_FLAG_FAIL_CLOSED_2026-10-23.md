# ADR — Fail-closed Git index flag verification for PR #119 audit host (2026-10-23)

**Status:** Implemented on isolated audit-tooling branch; locally tested, NOT authorized for production or paid runner execution.
**Application under test:** PR #119, commit `7fdf29010c85f16a9b38e5c93186f32e92192f3a`, tree `05f22f0ca387ae37573b1f81e85ead901dce3da9`.
**Release decision:** **NO-GO / HARD STOP**.

## Context and reproduced counterexample

The existing read-only preflight checked `git rev-parse HEAD`, `HEAD^{tree}` and `git status --porcelain=v1 --untracked-files=all`. These measurements are not enough to detect a tracked file whose Git index has `assume-unchanged` or `skip-worktree` set. In a disposable real Git repository, modifying a file with either index flag left `git status --porcelain=v1` empty. A wrong source checkout could thus be labelled locally clean despite a matching HEAD and tree.

## Decision

Add a read-only `git ls-files --cached -v -z` probe. Only nonempty normal `H` index entries qualify for this strictly immutable release checkout; lowercase `h`, `S`, unexpected prefixes, empty listing, and command failures are rejected. Evaluate `checkout.index_flags_safe === true` as a required condition. Return `CHECKOUT_INDEX_FLAGS_UNSAFE` on any unresolved flag and `CHECKOUT_DIRTY` when the checkout is not clean. Include `checkout_index_flags_safe` in diagnostics without emitting file paths, user data or secrets.

The process does not run `git update-index`, checkout, reset, fetch, Docker builds, tests outside local fixtures, remote Actions, merge or deployment. The maximum command output buffer is bounded at 4 MiB; excess output fails closed. Sparse/skip-worktree workspaces are intentionally disallowed for this specific immutable, non-sparse enterprise release audit.

## Verification and risk

- 5 focused new tests (2 policy checks, 2 real repository flag tampering reproductions, 1 command failure), **29/29 preflight PASS** and **72/72 combined audit-tooling tests PASS** under *local* Node v22.16.0.
- The real cost-free sandbox preflight remains exit 1 / NO-GO and the qualified host toolchain has not been demonstrated.
- Git index observations are local process evidence, **not a cryptographically authenticated byte-for-byte source attestation**. Independent runner provenance, pinned container image digest with verified signature, immutable source artifacts and four commit-bound human sign-offs remain mandatory.
- Current application Gate evidence: **0/15 qualified PASS**; approvals **0/4 verified**. No legal/security or Production GO is issued by this tool.

## Scope, cost, rollback

Modify only the audit-branch preflight script, its tests, status/runbook docs and this ADR. The PR #119 application HEAD, `main`, lockfiles, schemas, deployment config, and running environment are unchanged. All operations remain cost-free; no GitHub Actions minutes or paid external resources may be consumed. Rollback: revert this single audit-tooling commit on its dedicated branch. Do not force-push or merge automatically.
