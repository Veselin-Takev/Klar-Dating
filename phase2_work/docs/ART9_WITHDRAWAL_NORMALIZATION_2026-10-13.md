# Art. 9 consent withdrawal purpose normalization — 2026-10-13

## Finding
A purpose-specific revocation previously used `{ ...(existingState?.purposes || {}) } as Record<Art9Purpose, boolean>`. Where the stored consent map was missing or malformed, the resulting object could omit required purposes or preserve non-boolean values while TypeScript falsely assumed a complete `Record`.

## Change
`normalizeArt9Purposes` reconstructs all configured purposes from literal boolean `true` values, defaulting everything else to `false`. The revocation transaction uses the normalized snapshot before marking the requested purpose revoked and calculating its evidence hash. This change does not grant consent, read secret values, or change the audited Firestore transaction order.

## Validation and limits
Unit regressions: `npx vitest run tests/art9ConsentPurposeNormalization.spec.ts`. Before merge, also run `npm run typecheck`, emulator-backed transactional withdrawal tests (including missing user consent), and review data retention / concurrent writes. Tests were not executed in the user's Codespace; static and unit tests alone cannot prove GDPR compliance.

The local `security/v149-autonomous-consolidation` contains uncommitted work. Never force-merge or reset that branch. Official Issue #8 release decision remains **NO-GO**.
