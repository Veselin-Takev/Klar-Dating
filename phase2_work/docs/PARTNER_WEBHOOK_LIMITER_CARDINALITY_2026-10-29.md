# Webhook limiter key cardinality hardening — 2026-10-29

**Status: DRAFT / PRODUCTION NO-GO**

## Verified source finding
The prior webhook limiter keyed each request by caller IP **plus untrusted campaign slug**. An attacker can vary syntactically valid, nonexistent slugs to allocate separate per-slug distributed counters and evade a shared IP limit. Prior PR #193 checks syntax before the limiter but cannot constrain syntactically valid variants.

## Isolated change
The webhook limiter now keys by normalized IP alone. This enforces one shared per-IP request allowance across campaigns, including valid-looking unknown slugs. Response no-store headers, syntax preflight, HMAC signature verification, timestamp rejection, event idempotency, payload validation and conversion logic are unchanged.

## Residual risks / operating constraints
Per-IP limiting can penalize multiple legitimate partners behind the same NAT; observe 429 rate, trusted proxy IP configuration and campaign throughput in staging. This is **not** a global distributed rate cap or a substitute for a separate partner-level quota / per-partner authenticated identity; distributed attackers can still fan out across IPs. Do not key by untrusted unvalidated forwarding headers. Review webhook HTTP 429 and potential retry policies. The source-level regression `node scripts/test-partner-webhook-limiter-cardinality.mjs` is added but has not been independently executed yet; require explicit HTTP integration tests, load simulation, exact-HEAD CI, and independent Security/SRE/DPO approvals.

## Integration
Branch stacks on draft PR #193 which stacks on draft PR #192. Never merge redundant predecessor branches independently. Resolve and review a single merge path and obtain formal release owner signoff. Open P0 #55, #56, #70 and #8 remain blockers. No main change or deploy. **NO-GO**.

## Additional HTTP regression — 2026-10-29
Added an actual Express HTTP regression in `tests/partnerReferralRoutes.spec.ts`: malformed `INVALID_SLUG` must return 404 with private no-store/no-referrer headers and must not invoke the Firestore dependency. This verifies the early syntactic rejection behavior in a runtime test (not yet executed at this new HEAD). It does **not** establish 429 behavior under high traffic or fair usage for shared-NAT partner calls. Historical Enterprise CI #40909135829 PASSED at SHA `266148793661d1bba5c06c8641af70760b2d9899` before this additional test; new exact-HEAD CI remains pending. Independent specialist reviews and production GO remain blocked.
