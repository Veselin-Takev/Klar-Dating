# Klar & Partner — token data flow, deletion, and privacy release gates (2026-10-14)

Status: **P0 #56 OPEN; production NO-GO / NOT CONFIRMED**. This is a source-grounded engineering assessment, not a legal ruling or live-environment certification.

## Verified data flow (main 72a8a71be25029d908dc86a581c30bfd026ba10e)

1. Authenticated consenting adult calls `GET /api/partner/referrals`: `ensureReferralForCampaign` derives a deterministic HMAC token scoped to owner UID, campaign ID, and partner consent version. Storage uses a SHA-256 token document ID; `partner_referrals` holds the owner UID and campaign ID. Returned URL is `/api/partner/click/{token}`.
2. An external visitor requests the referral URL. `recordPartnerClick` validates token and campaign and owner consent/version. For eligible requests it transacts click counters + signed ledger and redirects to the partner's HTTPS destination with `klar_referral={token}` in the query. It does not validate the external partner's subsequent logs or subresources. For ineligible/prefetch requests it redirects directly without the token.
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
| B2B-P0-56-F | HTTP caching, proxies, redirects | Exact-head #62 tests and staging/CDN inspection on deployed revision with `Cache-Control: private, no-store` and `Referrer-Policy: no-referrer` where appropriate |

## Work decomposition before release

**P0 (approval-dependent):** agree lawful basis and controller roles; ban unbounded recipient retention of stable token; define partner data processing/storage periods, incident and deletion/withdrawal propagation. Establish approved API contract for opaque short-lived attribution codes and expiry/replay resistance before changing production semantics. Update privacy notices and consent evidence.

**P0 (engineering after approval):** test and implement a purpose-bound exchange without exposing raw UID, email or unbounded stable referral token to partner URL; fail closed for expired, withdrawn, self-referral and replay cases. Add Firestore emulator delete/retention/TTL receipts and recipient downstream log guarantees.

**P1 (operational):** staged tests for CDN/proxy leakage, rollback, rotation, retention automation and security/privacy reviewer signoff on the exact deployed SHA. Link signed evidence in issue #8.

No production token exchange mechanism, partner contract, or legal-approved retention period is implemented by this document. **Do not merge any implementation changing external contract without a compatibility plan and green exact-head gates.**
