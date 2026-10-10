# BE-01 API token revocation — 2026-10-10

## Scope and implementation

Parent candidate: 27aa6ab8d3e71b714c7dcdc50e8672e19342dad1.
Active application: phase2_work/.
Both server.ts requireAuth and src/core/auth/authMiddleware.ts now call Firebase Admin
verifyIdToken with checkRevoked=true. SDK failures remain fail-closed with HTTP 401;
no decoded identity is installed and no protected handler proceeds after rejection.
The existing account-deletion barrier and role/consent controls remain in place.
The central failure log no longer serializes provider error messages or objects.

The existing auth-boundary gate previously required checkRevoked=false. It now
requires true in both entry points and rejects explicit false calls.
Four isolated gate regressions are wired into check:auth-boundary, already part of check:enterprise.

This change adds no new environment variables, collections or schema assumptions.
It does not add a positive revocation cache, unsigned-token fallback or test identity to production.
The existing logout route still calls revokeRefreshTokens and cleans push tokens.
Client-side cleanup and direct Firebase Rules access are outside this API correction.
Already executing requests are not retroactively cancelled by token revocation.
Firebase timestamp precision and provider propagation apply; do not claim instantaneous global invalidation.

## Validation

Four new gate regressions failed against the original policy before correction and pass afterward.
They cover both approved call sites, each disabled check, and a missing checkRevoked argument.
All 42 dependency-free auth/runtime/release/scope checks pass locally under Node 24.19.0.
TypeScript syntax for the edited server, middleware and integration test was parsed with Node's
TypeScript transformer. This is not TypeScript typechecking.

The existing emulator integration suite verificationSecurity.spec.ts now includes:
- registered account token accepted by the live API and shared middleware;
- same token rejected by both after POST /api/auth/logout;
- a new credential login accepted;
- that new token rejected after the account is disabled.
The test crosses the original token's auth_time second boundary before revocation to avoid
confusing timestamp granularity with enforcement. Account fixtures are cleaned by the existing teardown.

The emulator test has NOT been executed here. No full typecheck, application, browser or
production validation is claimed. Required Node 22.23.3/Bun/emulator tooling is unavailable
in the inspected local environment. Provider availability and added verification latency
must be measured in the deployment-equivalent validation before release.

## Status and promotion

BE-01 implementation prepared on the existing non-PR correction branch.
Full required-toolchain validation and merge remain pending.
No new Actions run, release tag, deployment or production approval was initiated.
Follow CI_RESOURCE_POLICY.md before any CI-triggering promotion; reconcile the current budget.
Production remains NO-GO / NOT CONFIRMED.

Next P0: DB-01 cumulative deletion progress and final-sweep completion receipts.

## Reference

https://firebase.google.com/docs/auth/admin/manage-sessions
