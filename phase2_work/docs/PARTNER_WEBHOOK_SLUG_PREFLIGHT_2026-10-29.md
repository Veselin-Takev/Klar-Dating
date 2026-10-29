# Webhook slug preflight and distributed limiter boundary — 2026-10-29

**DRAFT / PRODUCTION NO-GO.**

## Finding
On consolidated PR #192, `POST /partner/webhook/:slug` accepted arbitrary unvalidated slug strings into the distributed rate-limit key before rejecting malformed slugs in the handler. Untrusted path values may induce unnecessary Firestore rate-limit work and high-cardinality key traffic. The existing HMAC validation remains enforced after the limiter.

## Scope
Move the existing slug syntax check into a dedicated middleware ordered after no-store response headers and before the distributed limiter. Rejected malformed slugs return the same 404 code/message without Firestore limiter invocation. Valid slug, HMAC and conversion logic remain unchanged.

## Evidence
Added a source-level ordering regression in `scripts/test-partner-webhook-slug-order.mjs`. Not yet executed in this environment; source check does not replace an HTTP negative test or malicious-traffic load test. **Security review must check cardinality limits for valid but unregistered slugs too**, as valid syntax does not prove a registered partner. Require combined exact-head CI, HTTP negative test, cloud cost rate analysis and independent Security/DPO/SRE review.

## Release
This PR is stacked on #192. Neither branch may be merged before independent reviews, a single controlled merge path and production approvals. P0 issues #55, #56, #70, #8 remain open. No deployment. **NO-GO.**
