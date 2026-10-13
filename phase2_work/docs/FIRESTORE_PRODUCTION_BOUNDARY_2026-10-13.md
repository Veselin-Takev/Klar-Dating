# Firestore production boundary hardening — 2026-10-13

## Scope
`src/server/db.ts` now returns the native Firebase Admin Firestore client for production, staging, tests and ordinary emulator/development operation. The `createDurableDbProxy` adapter is only selected when **both** `NODE_ENV=development` and `KLAR_ALLOW_DURABLE_DB_FALLBACK=true` are set.

## Rationale
The legacy adapter has incomplete Firestore-equivalent transactional, batch, and recursive-delete semantics. Wrapping a working production client could mirror writes before commit, use non-atomic batches and permit divergent local data. Its explicit developer-only use remains available for non-critical local experiments, not compliance, KYC, billing or deletion verification.

## Verification
Run `npx vitest run tests/nativeFirestoreBoundary.spec.ts` to verify mode selection without making live cloud calls. Follow with `npm run typecheck`, `npm run check:enterprise`, real Firebase emulator integration tests and the existing release gates. These tests validate routing, not a complete atomicity audit of the local proxy. No change here authorizes usage of the proxy for production or critical integration tests.

## Release
The user's `security/v149-autonomous-consolidation` Codespace has uncommitted changes and is not this PR branch. Review and cherry-pick/merge only after reconciling those changes. Issue #8 remains **NO-GO**, including production identity, alarm delivery, secret rotation, exact-SHA validation, and accountable approval.
