# Issue #48 — Private referral HTTP response hardening (2026-10-28)

**Draft / Production NO-GO**. Stacked on PR #173 (HEAD baseline `65055c50d7e7e2d9feda6c55a87cc73f1b46470b`), which itself depends on #172. Do not merge this change before its parent dependencies are safely integrated.

## Finding

`GET /api/referral` returns a UID-derived invitation code and share URL. `POST /api/referral/claim` returns an account-attribution result. These endpoints did not explicitly set `Cache-Control: no-store` or `Referrer-Policy: no-referrer`. Intermediary HTTP cache behavior should not be relied upon for invitation secrets or sensitive errors.

## Fix and validation

A shared endpoint-specific middleware sets `Cache-Control: no-store, private`, `Pragma: no-cache` and `Referrer-Policy: no-referrer` **before** referral rate limiting and authentication handling, on both GET and POST. Four HTTP regression scenarios assert success/error headers; the original authorization, state transactions and error bodies are unchanged. Execute `bun run typecheck`, `bun run vitest run tests/launchEndpoint.spec.ts` and `bun run check:enterprise`. No local or cloud tests were executed while authoring; a fresh exact-HEAD CI run is mandatory.

## Limits

These are response-cache and referrer protections, **not** full URL-token leakage prevention: share URLs can still be revealed to intended recipients, external analytics, browser history, and downstream redirects. Existing referral token strength, idempotency, age eligibility, Didit KYC, anti-abuse, consent, Art.17 and reward-economics requirements under #48/#8 remain open. No production changes, deployments or rewards authorized. Rollback: revert this isolated PR. **NO-GO**.
