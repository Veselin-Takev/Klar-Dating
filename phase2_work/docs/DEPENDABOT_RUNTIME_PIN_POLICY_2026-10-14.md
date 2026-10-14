# Dependabot Docker runtime policy — 2026-10-14

## Evidence and decision
Automated Docker update PR [#40](https://github.com/Veselin-Takev/Klar-Dating/pull/40) bundles Bun 1.4.2 → 1.4.3 with Node 22.23.3 → **26.11.1**. Its [Enterprise CI run 38520461202](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/38520461202) failed the existing `scripts/check-runtime-node-alignment.mjs` gate. The current production Node image digest and runtime versions remain pinned in `phase2_work/Dockerfile`, CI and the gate.

The repository-root Dependabot configuration now excludes the Docker `node` dependency from **automatic** version updates while still allowing independent Bun/container dependency changes. This prevents unrelated automated container updates from bundling an unauthorized runtime migration. It does not waive security monitoring or authorize unpatched Node deployments. Security and maintenance owners must track Node 22 security advisories and deliberately update the immutable image digest or authorize a coordinated runtime migration with regression/security/performance evidence.

## Required verification
Review the Dependabot `docker` ecosystem's `ignore` configuration; run `bun run check:dependabot-config`, `bun run check:ci-toolchain-pins`, `node scripts/check-runtime-node-alignment.mjs`, TypeScript/build and exact-head CI. PR #40 remains **blocked** until regenerated without the unauthorized Node bump, reviewed and validated; do not override the failed gates.

PR #39 is separate: pinned GitHub Actions updates fail `check:ci-toolchain-pins` and need an approved immutable commit-pin policy review. Production release Issue #8 remains **NO-GO**.
