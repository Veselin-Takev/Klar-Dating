# Partner webhook payload / HMAC negative HTTP regression — 2026-10-29

**DRAFT / PRODUCTION NO-GO.**

## Change
Add an Express HTTP-level regression using an in-memory Firestore transaction double and realistic JSON parser. A syntactically valid campaign slug with a malformed conversion body must return HTTP 400 (`invalid_partner_event`); a schema-valid conversion body with an invalid HMAC must return HTTP 401 (`invalid_partner_signature`). Both responses must be private/no-store and avoid referrer disclosure. Existing webhook service HMAC verification remains unchanged.

## Limitations
These are denial-path HTTP regressions, **not** positive proof of true partner purchase provenance, replay handling, production secret rotation or buyer binding. No emulator/live cloud calls, no load simulation, no SRE/DPO signoff. Test not yet executed on the new commit; exact-HEAD CI is required.

## Governance
Stacked on #195 → #194 → #193 → #192. No duplicate ancestor merges. Formal Security/DPO/SRE and release-owner approval required before integration. Issue #55 remains P0; #56, #70, #8 remain blocked. **NO-GO.**
