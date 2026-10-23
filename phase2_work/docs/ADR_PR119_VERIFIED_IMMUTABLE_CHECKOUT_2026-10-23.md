# ADR — Actual Immutable Git Checkout Is a Mandatory Host Preflight Observation

**Date:** 2026-10-23  
**Decision:** Adopt read-only actual HEAD/tree/root/cleanliness inspection before any authorized host audit.  
**Scope:** Audit tooling only; NOT PR #119 or production.  
**Release state:** NO-GO / HARD STOP.

## Problem

The earlier host preflight compared its caller-supplied target commit to the expected PR #119 commit, but did not inspect the actual local repository to be tested. A correct argument could therefore coexist with a different checkout. These are not equivalent: input assertions are not independently observed facts.

## Decision

Require a separately supplied, absolute source-checkout root, physically resolved without symlink redirects, via `--checkout` or explicit `KLAR_AUDIT_CHECKOUT_DIR`. In that checkout, execute read-only, bounded Git commands with no shell, no optional locks and `core.fsmonitor=false`:
- `git --no-optional-locks -C <root> rev-parse --show-toplevel`, require exact physical root.
- `git --no-optional-locks -C <root> rev-parse --verify HEAD`, require SHA `7fdf29010c85f16a9b38e5c93186f32e92192f3a`.
- `git --no-optional-locks -C <root> rev-parse --verify HEAD^{tree}`, require tree `05f22f0ca387ae37573b1f81e85ead901dce3da9`.
- `git --no-optional-locks -C <root> status --porcelain=v1 --untracked-files=all`, require empty status.

Do not fetch, clone, checkout, reset, edit or execute application binaries during this preflight. An absent or mismatched checkout must fail closed. The audit tooling runs from a **different branch/SHA**, never use its repository as the application checkout.

## Verification

New preflight: 24/24 focused tests PASS under available Node v22.16.0. Verifier/sealer regression tests: 43/43 PASS (67 total). Tests include a real temporary repository with wrong HEAD, another with untracked files, symlink and absent-checkout denial, wrong Git tree and nominal-input spoofing.

Actual local preflight: exit 1 / NO-GO due to missing required runtime, Bun/Docker, approved digest, independently authenticated host scope and actual target checkout. These are local diagnostics only; **0/15 Enterprise-host Gates PASS evidenced and 0/4 independent release approvals evidenced**.

## Threat limitations and decision ownership

An attacker controlling the full authorized host can forge local Git output. This check detects ordinary drift/configuration errors but does **not** establish independently attested build provenance, Security sign-off, Release Owner authorization or legal compliance. Four independently authenticated sign-offs remain mandatory; the code never decides GO.

The user has explicitly authorized only **cost-free** work. No paid Runner, GitHub Actions invocation, deployment, merge, or reopening of the production correction cycle is authorized here. No changes to application, dependencies, persistence schema or API. Rollback: revert only this audit-tooling change set.
