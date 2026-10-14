# Klar & Partner — P0 conversion trust-boundary decision record (2026-10-14)

Status: **OPEN, NO-GO for paid/credited partner conversion settlement**. Source: `src/server/routes/partnerReferrals.ts`, `src/server/partnerReferralCore.ts`, `src/server/partnerReferralService.ts` at main `f423afeb60cdce82a94330b2daf2d3c4a332e512`.

## Observed and proved in source
- `POST /partner/webhook/:slug` validates a strict conversion payload, partner-specific HMAC and freshness window, with distributed rate limits.
- Payload contains `eventId`, `referralToken`, `buyerUid`. These are **partner-asserted** values. A signed message proves possession of partner secret, not an independently verified sale or buyer consent at sale time.
- `recordPartnerConversion` checks claimed buyer existence, age, present partner consent, absence of account deletion, campaign/owner status and per-buyer idempotency via transactional Firestore docs. It records `rewardStatus: 'earned'` and increments counters.
- There is no independent signed purchase/fulfillment proof in this payload, no server-issued transaction reference bound to authenticated buyer plus offer, and no settled/reversed payment state in the examined path.

## Threats / impact
1. Compromised or dishonest partner secret holder fabricates `buyerUid` for any eligible consented account and creates seemingly qualified transactions (reward/accounting fraud).
2. HMAC key exfiltration grants impersonation until keys rotated; replay window alone cannot establish purchase authenticity.
3. Refunds, disputes and service failures are absent from this event schema; `earned` could be misread as paid/fulfilled.
4. Long-lived `klar_referral` in partner query and logs increases privacy and attribution risk; address separately in #56.

## Safe design choices requiring Product/Security/Legal agreement
A. **Preferred for paid rewards**: Server-issued, time-bound, single-use buyer attribution intent after authenticated, explicit user interaction; store campaign, buyer reference, consent version and hashed nonce. Partner callback references the intent; validate intent + partner signature + purchase evidence and finality, atomically transition `pending → verified → eligible`. Require real partner transaction ID with scoped, idempotent reconciliation, signed refund/reversal messages and separate settlement.
B. If partner cannot provide buyer verification/proof, count only a non-payable `partner_reported` event. Do not increment qualified paid rewards or assert `earned`.
C. All paths maintain no direct UID exposure to third-party URLs; partner API only gets tightly scoped opaque references. Explicit purpose-bound retention, consent withdrawal and Art.-17 cascade tested.

## Strict acceptance gates
- Product/Security/Privacy/Finance approve trust contract **before** API or schema breaking changes.
- Test forged buyer reference, unrelated intent, stale/replayed intent, tampered campaign, webhook key rotation, multi-purchase, concurrent settlement, self-referrals, refund/reversal and account deletion in emulator and E2E.
- Rollout dark behind feature flag; external partner integrations contract-versioned and migrated; no existing link/consumer break without compatibility plan.
- Real Cloud Run/IAM/secret monitoring plus on-call/rollback evidence in #8.

The existing HMAC and transactional checks are valuable but **not sufficient for monetized settlement**. No new eligibility behavior is authorized by this document alone. Issue #55 tracks implementation and remains OPEN.
