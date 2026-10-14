# Onboarding activation ID fallback — 2026-10-14

## Defect
The API route formerly compared `eventName` against `onboarding_v2_started` / `onboarding_v2_completed`, but actual frontend event names are `onboarding_started` / `onboarding_completed`. Therefore requests omitting `eventId` did not receive the intended UID-scoped deterministic fallback.

## Remediation
The route now calls the pure, tested `resolveActivationEventId` helper. For the two supported events, absent IDs become `onboarding_v2_started_<uid>` / `onboarding_v2_completed_<uid>`. Client-provided string IDs remain unchanged, other event names do not acquire a fallback, and malformed non-string IDs are not forwarded.

This changes neither user authentication nor the distributed per-UID rate limiter, the backend event validation/recording contract, client event payloads, or the Founding 500 transaction.

## Verification required
Run `bun run typecheck`, `bunx vitest run tests/activationEventId.spec.ts`, route/API integration tests, `bun run check:enterprise` and full CI on the exact PR head. Review for any duplicate-activation behavior differences and preserve the idempotency guarantee.

The original Codespace `security/v149-autonomous-consolidation` and separate `integration/v149-safe-sync` worktree are untouched by this GitHub branch change. **Production NO-GO** until integrated checks and official approval are recorded.
