# P0 #55 — Webhook replay event/buyer-claim consistency (2026-10-18)

**Status: Draft, NO-GO.** Stacked onto PR #93.

## Threat and resolution
The partner conversion transaction creates both an event and a buyer-claim document atomically. On replay, however, an event with matching HMAC was accepted as duplicate even when the buyer-claim document was missing, attached to another conversion, or mismatched on campaign, referral or buyer pseudonym. Such a state can occur through manual repair, a legacy migration, retention misconfiguration, or tampering; it must not yield a positive duplicate acknowledgment.

The replay path now validates the claim exists and its `conversionId`, `campaignId`, `referralId` and pseudonymous `buyerRef` agree with the event and current signed payload, **within the existing Firestore transaction**. Absent or inconsistent buyer claims fail with 409 `partner_claim_inconsistent`. No buyer UID or token is persisted in the exception. Existing event-binding checks and fresh owner/buyer consent, deletion and campaign eligibility checks remain mandatory. New conversions still record a provider assertion for independent verification and earn no reward.

## Regression and rollout
An in-memory Vitest test creates a valid conversion, deletes the buyer-claim, verifies 409, then corrupts its conversionId and verifies 409, restores it and verifies a genuine duplicate succeeds. Run `npx vitest run tests/partnerReferralService.spec.ts` on Node 22.23.3 with installed dependencies; also run Firebase Emulator concurrency and deletion tests.

Do not automatically regenerate missing buyer claims. Audit and quarantine inconsistent records under separate Security/Privacy/Finance approval, review retention, and reconcile only with two-person approval and traceable evidence. A provider may now see 409 for corrupted previously acknowledged events; update retry/quarantine handling before rollout. The fix does not prove buyer identity or purchase fulfillment and is not a complete fraud solution.

No deploy, merge to main or paid CI run was initiated. P0 #55 and go-live #8 remain open.
