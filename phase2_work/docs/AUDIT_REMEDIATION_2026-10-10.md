# Runtime policy remediation — 2026-10-10

## Scope

Finding INF-01. Baseline: `476c808cb5689aaca178b1d8ad6c607fb9017103`.
Active source: `phase2_work/`; workflows: repository-root `.github/workflows/`.
No AGENTS.md was present in the inspected baseline tree.

[CI 37978229573](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/37978229573)
failed in Enterprise static gates because the active Docker runtime used Node 26.10.0,
while the approved runtime gate requires Node 22.23.3 and its immutable digest.
Downstream typecheck, Functions build, tests, build, smoke and browser acceptance were skipped.

## Correction

- Restore the exact runtime image required by the existing gate.
- Run the runtime gate and its isolated regression tests before toolchain setup and dependency installation in CI.
- Preserve CI's existing full-validation condition and all downstream checks.
- Run the same preflight unconditionally in the tag-release job before installation/publication.
- Add regressions for accepted approved image, rejected Node 26 and rejected changed digest.
- Preserve the existing check:enterprise runtime gate.

The preflight uses the runner's bootstrap Node to inspect repository configuration;
it does not certify the bootstrap interpreter as Node 22.23.3.
The existing setup-node step still selects Node 22.23.3 for application validation/build.

## Local evidence

Available interpreter: Node 24.19.0.

| Check | Result |
|---|---|
| Runtime policy regressions | 3 passed |
| Existing CI scope regressions | 3 passed |
| Runtime alignment | PASS |
| CI toolchain pins | PASS |
| Dependabot configuration | PASS |
| Existing release-workflow structural gate | PASS |
| Modified YAML parsing, preflight ordering and CI scope condition | PASS |

Commands executed from phase2_work:

```sh
node --test scripts/runtime-node-alignment-check.mjs scripts/ci-scope-check.mjs
node scripts/check-runtime-node-alignment.mjs
node scripts/check-ci-toolchain-pins.mjs
node scripts/check-dependabot-config.mjs
node scripts/check-release-workflow.mjs
```

Only targeted source files were materialized; this was not a full installed checkout.
Node 22.23.3, Bun and Docker were not available through the inspected environment.
No full application, emulator, browser or container validation was performed.

The existing release structural gate's PASS does not close SEC-01:
lockfile regeneration and exact-SHA CI binding remain unchanged.

## Promotion

This candidate is retained on a separate non-PR branch. No Actions run was initiated.
Before a remote-triggering PR/push, use a complete checkout and the approved toolchain,
run the local preflight, reconcile the current Actions ledger and reserve the required runtime cap
under CI_RESOURCE_POLICY.md. Historical remaining-minute figures are not current billing.

INF-01 is implementation-complete on the candidate, not fully validated or merged.
Production remains NO-GO / NOT CONFIRMED.

## Next findings

1. SEC-01: frozen release installation and full CI success for the exact release SHA before publication.
2. BE-01: token revocation with stale-token regression coverage.
3. DB-01: atomic cumulative progress, final-sweep receipts and explicit legacy-receipt handling.
4. Branch protection and production operational/governance evidence.

No other finding is marked resolved by this change.
