# Klar & Partner — token data flow, deletion, and privacy release gates (2026-10-14)

Status: **P0 #56 OPEN; production NO-GO / NOT CONFIRMED**. This is a source-grounded engineering assessment, not a legal ruling or live-environment certification.

## Source data flow reconciled 2026-10-24 (main 58600c5e7f43d015753357dff0e5365823287db4)

1. Authenticated consenting adult calls `GET /api/partner/referrals`: `ensureReferralForCampaign` derives a deterministic HMAC token scoped to owner UID, campaign ID, and partner consent version. Storage uses a SHA-256 token document ID; `partner_referrals` holds the owner UID and campaign ID. Returned URL is `/api/partner/click/{token}`.
2. A visitor requests the referral URL. Attribution now requires a freshly verified, non-anonymous Firebase bearer token (including revocation check), an independently consenting adult visitor with a valid consent epoch, and transaction-time rechecks of visitor/owner/campaign state and destination. Anonymous/ineligible visitors receive no attribution token. `recordPartnerClick` validates token and campaign and owner consent/version. For eligible requests it transacts click counters + signed ledger and redirects to the partner's HTTPS destination with `klar_referral={token}` in the query. It does not validate the external partner's subsequent logs or subresources. For safe direct-redirect cases it omits the token; malformed/stale/unavailable records may instead be rejected.
3. The owner opening their own offer with `POST /api/partner/open/:campaignId` receives a validated external destination carrying `klar_referral={token}` without counting an external click; this is still disclosure of a correlatable token to an external controller/recipient.
4. Partner webhook `POST /api/partner/webhook/:slug` receives signed `qualified_conversion` containing `eventId`, `referralToken`, and partner-asserted `buyerUid`. Transaction verifies age/current consent and stores pseudonymous conversion and claim documents. The webhook signature proves partner key possession, not a real sale: #55/#60 remain separate blockers.
5. `setPartnerConsent(false)` increments the owner token version, invalidating future attribution. That does **not** revoke token copies already received in partner logs, browser history, proxy logs or downstream analytics.

## Unresolved risk register

| ID | Control/question | Required verifiable evidence |
|---|---|---|
| B2B-P0-56-A | Purpose and lawful basis for public click counting, member opt-in and partner conversion | DPO/Legal decision per actor/processing purpose, consent and withdrawal UX and versioned policy copy |
| B2B-P0-56-B | Token in partner query string can persist across third-party access logs, CDN, referral analytics, browser history | Partner-by-partner contract, token minimization plan (e.g. short-lived purpose-scoped exchange code), log scrubbing and leakage regression tests |
| B2B-P0-56-C | The external provider receives token and may combine with purchase/user data | Controller/processor matrix, data-sharing terms, jurisdiction/subprocessor inventory and access restrictions |
| B2B-P0-56-D | Personal and pseudonymous `partner_referrals`, `partner_referral_conversions`, `partner_referral_buyer_claims`, `partner_referral_ledger`, rate-limit docs | Binding retention/legal-hold schedule with real Firestore TTL configuration evidence and account deletion test receipts |
| B2B-P0-56-E | Erasure and consent withdrawal across partner-side copies and delayed webhooks | Realistic emulator staged test, propagation/partner-notification contract, dispute/finance exceptions and per-case audit evidence |
| B2B-P0-56-F | HTTP caching, proxies, redirects | Current-main partnerReferralRoutes.spec.ts tests and staging/CDN inspection on deployed revision with `Cache-Control: private, no-store` and `Referrer-Policy: no-referrer` where appropriate |

## Work decomposition before release

**P0 (approval-dependent):** agree lawful basis and controller roles; ban unbounded recipient retention of stable token; define partner data processing/storage periods, incident and deletion/withdrawal propagation. Establish approved API contract for opaque short-lived attribution codes and expiry/replay resistance before changing production semantics. Update privacy notices and consent evidence.

**P0 (engineering after approval):** test and implement a purpose-bound exchange without exposing raw UID, email or unbounded stable referral token to partner URL; fail closed for expired, withdrawn, self-referral and replay cases. Add Firestore emulator delete/retention/TTL receipts and recipient downstream log guarantees.

**P1 (operational):** staged tests for CDN/proxy leakage, rollback, rotation, retention automation and security/privacy reviewer signoff on the exact deployed SHA. Link signed evidence in issue #8.

No production token exchange mechanism, partner contract, or legal-approved retention period is implemented by this document. **Do not merge any implementation changing external contract without a compatibility plan and green exact-head gates.**

## Reconciliation and evidence limits — 2026-10-24

The direct signed-in open flow still uses trackedDestination and exposes the referral token to the partner; visitor-route hardening does not remove this recipient risk. Query injection and nonempty fragments are rejected in campaign destinations. Withdrawal/quarantine and deletion-state gates were strengthened; none proves erasure of partner-side copies. The retention plan now covers 20 groups and requires separate matrix-revision, legal/inventory, staging identity and existing-policy checks before any mutation. Live ACTIVE evidence and legal approval remain unconfirmed.

Main CI on 58600c5 passed 1230 tests in 182 files plus build/smoke/browser acceptance: https://github.com/Veselin-Takev/Klar-Dating/actions/runs/40044983802 . This is code validation, not a live Cloud/partner/CDN assessment or legal signoff. #55/#56/#70/#8 remain open. No deployment or TTL mutation.
