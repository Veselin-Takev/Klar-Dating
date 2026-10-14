# Historical release provenance gate — 2026-10-14

## Finding
The `check:release-provenance` gate verified the historic 2026-10-08 candidate date and artifact hash plus a pending evidence status, but did not enforce the `releaseGovernance` NO-GO fields. A green static output is **not** evidence of live release readiness. The manifest itself carries historical source SHA and an unverified candidate.

## Remediation
The existing history-consistency gate now additionally requires `releaseGovernance.decision = NO-GO`, `productionApproved = false`, `candidateVerified = false` and `fullPreflight = BLOCKED`. Output explicitly states historical status and is not a production attestation. Four regression tests execute within the existing `check:release-provenance` enterprise command to reject false approvals, fabricated candidate verification and changed pending evidence.

This gate is intentionally historical and should not be adapted by simply changing constants for a future release. A future approved release requires an **independent** manifest or evidence record bound to the actual git SHA, artifact digest, SBOM, build job, attestations, real infrastructure validation, and named approvals. Never rewrite old candidate records to simulate signoff.

## Verification and release decision
Run `bun run check:release-provenance`, `bun run check:enterprise`, TypeScript/tests, and the exact-head CI before merging. Final operational controls and named approval remain in [Issue #8](https://github.com/Veselin-Takev/Klar-Dating/issues/8). **Production NO-GO**.
