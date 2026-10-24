# P0 #55 — Adversarial conversion assertions / test evidence (2026-10-18)

**Release state: NO-GO.** Existing service records partner-signed conversion events in `pending_verification` with `proofStatus=partner_assertion_only` and does not grant rewards or increase qualified conversion counters from a signed assertion alone. A partner signing key proves sender possession, not a real purchase or claimed buyer identity.

## Regression extension

`tests/partnerReferralService.spec.ts` now covers buyer consent withdrawal, minor buyer, owner withdrawal, invalid owner referral version, altered campaign slug, self-referral, a second claim for the same buyer with another event ID, and a control that counters remain at zero. It complements an existing exact-event replay test.

Test locally from `phase2_work`: `npx vitest run tests/partnerReferralService.spec.ts`. The in-memory Firestore mock does **not** emulate transaction contention, retries, atomic commit, actual security rules, signed HTTP requests, or third-party purchase proof; a passing test is not a full P0 closure.

## Remaining P0 requirements

An independently authoritative purchase/fulfillment reference must bind campaign, buyer, order and settlement status. Do not trust a partner-supplied `buyerUid` as purchase evidence. Add test cases for revoked provider signing keys, timestamp expiry, concurrent double claim on Firebase Emulator, forged orders, refund/chargeback and dispute/reconciliation. Hold any reward until independent verification. Apply a GDPR-approved retention period and deletion/ledger exceptions. Require separate Security, Finance and Privacy review and production telemetry evidence.

No cloud changes or merge into `main` made by this test-only branch. Rollback is a revert of the test-only commit and does not change production data or schema.

## Current-main preparation — 2026-10-24

The seven cases are appended to main cd8fe79 without replacing its existing 20 service tests. Eligible buyer fixtures now carry partnerReferralVersion=1 and referral fixtures bind campaignSlug. Seven targeted cases PASS locally under Node 24.22.1 / Vitest 5.0.5; existing 20 cases were skipped in this focused run. Database module initialization was stubbed; any FieldValue increment in these conversion tests throws. These remain in-memory service tests, not Firebase Emulator or signed HTTP integration. Full pinned exact-head CI remains required after publication. No production code, cloud settings or approvals changed. #55/#8 remain open.
