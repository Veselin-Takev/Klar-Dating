# Art. 9 AI-derived profile disclosure suppression — 2026-10-13

## Finding and change
`getArt9FieldsToPurge('ai_personality_insights')` lists `aiPersonalitySummary`, `aiBioSummary`, and `personalityRadar`, but the read-time `filterProfileSensitiveFields` did not suppress those fields without active consent. The filter now removes all three if AI insights consent is absent, withdrawn, version-invalid or explicitly denied. This provides a disclosure guard while asynchronous or transactional data cleanup is pending.

## Boundaries
The helper makes a shallow copy and checks top-level properties only. This patch does **not** prove all downstream API routes use the helper, nor does it purge nested AI values, backups, caches, search indexes, or existing third-party copies. Evaluate all data egress paths and persistence retention separately before a GDPR compliance claim. A consent grant alone must not override other lawful-basis, access-control, data minimization or purpose limitations.

## Verification
Run `npx vitest run tests/consentAiProfileFilter.spec.ts`, `npm run typecheck`, Firebase emulator consent-withdrawal integration tests, and full enterprise gates on exact PR head. The tests are committed but have **not** been run in the user's Codespace. Do not merge without review and passing CI. Production Issue #8 remains **NO-GO**.

The user's local `security/v149-autonomous-consolidation` contains uncommitted changes; this separate GitHub branch must not overwrite them.
