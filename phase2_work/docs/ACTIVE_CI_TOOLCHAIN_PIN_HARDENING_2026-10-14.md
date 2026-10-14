# Active CI toolchain pin verification — 2026-10-14

## Finding
The `check-ci-toolchain-pins.mjs` gate previously searched raw workflow text with `includes(...)`. A commented-out approved GitHub Actions SHA could satisfy the check even if the active `uses:` entry referenced an unapproved tag or commit.

## Remediation
`scripts/toolchainPinPolicy.mjs` now evaluates active `uses:` declarations for the approved exact immutable `actions/setup-node` and `oven-sh/setup-bun` SHA references. Missing expected actions and any extra unapproved references fail validation; commented lines cannot satisfy the gate. Active Node-version declarations must remain 22.23.3. The same enterprise check command remains active.

The `check:ci-toolchain-pins` package script now runs the five regression tests **before** checking the live workflows. Thus the existing `check:enterprise` chain automatically enforces the test suite on subsequent CI runs.

## Tests and acceptance
`node --test scripts/toolchain-pin-policy-check.mjs` covers approved pins, commented-pin spoofing, additional unapproved actions, commented Bun references and an unauthorized Node version. Required before merge: exact-head CI success, `bun run check:ci-toolchain-pins`, `bun run check:enterprise`, and independent review of workflow inputs/permissions. This is a focused hardening of a textual policy check, not a complete YAML semantic or provenance audit.

Previous PR #37 release evidence correction and #44 approved pin update were merged with passing head CI. There is no automatic authorization for production; [Issue #8](https://github.com/Veselin-Takev/Klar-Dating/issues/8) remains **NO-GO**.
