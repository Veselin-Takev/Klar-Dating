# Immutable GitHub Actions pin review — 2026-10-14

## Context
Dependabot PR #39 proposes a grouped GitHub Actions upgrade:
- `actions/setup-node` v7.0.0 (`820762786026740c76f36085b0efc47a31fe5020`) → v7.1.0 (`949feb2413d6458794dcd2491c4babbbce0c15c1`);
- `actions/upload-artifact` previously pinned to `043fb46d1a93c77aae656e7c1c64a875d1fc6a0a` → `cf430e030ddbb5b0abf93d22962f4752f3646cd9`.

The failed [CI run 38520342943](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/38520342943) reported the exact mismatch in `check:ci-toolchain-pins` in `ci.yml`, `llm-evaluation.yml`, and `release.yml`.

## Change under review
This review branch is based on the PR #39 head and updates the existing *strict* toolchain gate to recognize the newly proposed immutable `actions/setup-node` commit pin. All workflows continue to use Node **22.23.3**, Bun **1.4.2** and immutable 40-hex GitHub Actions references. No wildcard/tag-based Action reference is introduced, and no gate is disabled.

## Security acceptance criteria
Before merge, reviewers must independently verify that the proposed exact action commits correspond to the intended upstream releases, compare changes and permissions/security implications of both Actions, confirm compatibility with the organization's runner/Node toolchain, and confirm this PR's exact-head CI (including `check:ci-toolchain-pins`, release-workflow checks, TypeScript and tests) passes. CI success **alone** is not upstream code provenance verification.

Do not merge original PR #39 and this branch separately: this branch already includes PR #39's workflow changes. Avoid duplicate upgrades.

Operational/live-provider tests, privacy/compliance signoffs and official production authorization remain unresolved. **Production NO-GO**.
