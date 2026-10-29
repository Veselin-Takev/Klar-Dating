# Fresh signed webhook HTTP trust boundary — 2026-10-29

**DRAFT / PRODUCTION NO-GO**

## Added regression
A real Express HTTP test constructs a valid conversion payload, fresh Unix timestamp and correctly computed campaign HMAC. The request must pass schema validation and HMAC verification and reach the service's referral existence check, which rejects the nonexistent signed referral with HTTP 404 `partner_link_not_found`. Response privacy headers must remain intact. It uses an in-memory Firestore double.

## Evidence boundary
This is a **positive HMAC verification / negative referral lookup** test; it is **not** a successful conversion, actual partner purchase proof, in-window replay/201→200 integration test, or real emulator concurrency. No new service logic was changed. New HEAD CI and independent Security/SRE/DPO reviews remain required.

## Governance
Stacked on Draft #197 and earlier drafts #196–#192; use one reviewed integration path. P0 #55, #56, #70, #8 remain blocked. No main merge or deployment and no production GO.
