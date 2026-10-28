# P0 #48 — Strict public invitation origin (2026-10-28)

**Status: Draft / NO-GO.** Parent PR #175, head `627937f2e7092542209f5982766f8072722f5582`; sequential PR stack #172 -> #173 -> #175 -> this PR.

## Finding and decision

The GET /api/referral endpoint checked `PUBLIC_URL` using only a permissive HTTPS regular expression and joined it with an invitation code. A URL carrying userinfo, query, fragment, or path could generate an unsafe or broken invitation link. Only a bare HTTPS origin is accepted, with optional trailing root slash. URL parsing rejects credentials, non-root paths, queries, fragments, whitespace, and backslashes. The output is constructed from the normalized `URL.origin`, not from raw configuration text; invalid configuration returns existing HTTP 503 without modifying user referral state.

## Verification

Nine HTTP regression cases exercise unsafe origins and the permitted trailing slash, alongside existing referral claim, no-store headers, age eligibility, and idempotency tests. CI must prove typecheck, tests, security gates and build on this PR's **exact HEAD**; no local or production validation was executed at authoring. No secrets or personal identifiers are introduced.

## Remaining risk

This is configuration-hardening, not proof that the configured domain is legitimately operated by Klar; ownership and allowlisting remain deployment-configuration obligations. Referral tokens still exist in share URLs and require separate lifecycle, privacy, replay, abuse protection and Art.17 review. No production mutation or reward change. Rollback by reverting the isolated PR. Formal production approval remains NO-GO.
