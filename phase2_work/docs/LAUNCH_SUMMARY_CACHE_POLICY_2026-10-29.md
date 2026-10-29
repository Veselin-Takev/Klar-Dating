# Private launch summary caching guard — 2026-10-29

**Status: DRAFT / PRODUCTION NO-GO.** Based on integrated PR #189 HEAD `00f623c5b97b0a5ae5ab3ecf876ecaba01a7ce68`; do not merge separately onto main without integrating the parent PR.

## Risk and correction
`GET /api/launch/summary` derives a city from the authenticated user's private profile and emits launch/community density. Although the response is aggregate, caches must not store or replay user-context responses between accounts. Apply `Cache-Control: private, no-store`, `Pragma: no-cache` and `Referrer-Policy: no-referrer` before UID rate limiting and authentication to cover successful and rejected requests. Does not introduce new user fields, persistence, tracking or logging.

## Test and release evidence
The HTTP regression in `tests/launchEndpoint.spec.ts` checks header values on both successful and unauthenticated paths. Test code committed, **not locally executed**; exact-head CI, test logs, security/privacy review and downstream integration into #189 remain outstanding. No production change, no main merge. On rollout, monitor client compatibility and browser/network caching. This is defense-in-depth, not a substitute for deletion, partner consent, or TTL verification. **NO-GO**.
