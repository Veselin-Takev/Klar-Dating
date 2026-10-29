# Shared-IP webhook 429 HTTP regression — 2026-10-29

**DRAFT / MERGE BLOCKED / PRODUCTION NO-GO.**

## Test added
The Express HTTP regression in `tests/partnerReferralRoutes.spec.ts` seeds a Firestore transaction double with the 120-request window already exhausted for one normalized loopback IP. It then sends requests to two **different syntactically valid** campaign slugs and asserts HTTP 429, Retry-After and no-store for **both**. The test uses the distributed limiter's hash derivation and the library's IP normalization instead of a stale hand-written key. This checks that changing a campaign slug does not buy a fresh per-IP counter.

## Limitations and proof required
This is a deterministic mocked-Firestore HTTP integration test, not a real Firebase emulator concurrency test, distributed multi-IP load test, partner validity check, or reverse-proxy/trusted-IP staging proof. The test is committed but not yet executed on the new SHA. Full exact-HEAD Enterprise CI and Security/SRE/DPO reviews required. NAT fairness, replay/partner conversion truth and production retention remain P0 release blockers.

## Dependency
Stacked on Draft PR #194 → #193 → #192. Merge only once through reviewed integration; no duplicate ancestor merges to main, no deploy and no GO.
