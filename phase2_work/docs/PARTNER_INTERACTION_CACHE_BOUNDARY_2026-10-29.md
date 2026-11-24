# Partner interaction audit-response cache boundary — 2026-10-29

**DRAFT / MERGE BLOCKED / PRODUCTION NO-GO.**

## Finding and correction
On inspected `main`, POST `/partner/interaction` returns a user-linked interaction audit acknowledgement yet was the sole private partner action in this route group that did not apply existing `noStorePartnerPrivateData` response middleware. It now applies the established cache/referrer policy **before** account authorization and rate limiting, including rejected requests. No persistence, consent semantics, ledger or authentication logic changed.

## Regression and evidence
Added source-level contract `node scripts/test-partner-interaction-cache.mjs` checking middleware ordering and exact header definitions. It has not been executed locally or in CI at the time of this commit. Source scanning is not a substitute for an actual HTTP integration test, reverse-proxy cache probe, or security review. Exact-HEAD CI, relevant test gates, DPO and Security reviews remain mandatory. No main merge, production changes, or release approval.

## Rollback and integration
Rollback only via an isolated revert after privacy review; do not drop no-store protections without an equivalent control. This PR is intentionally independent of the #189 → #190 stacked changes, but must be integrated in a reviewed final tree. Open P0 #55, #56, #70 and operational #8 remain blockers.
