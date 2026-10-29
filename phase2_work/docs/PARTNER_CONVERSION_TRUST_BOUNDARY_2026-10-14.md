# Klar & Partner — P0 conversion trust-boundary decision record (2026-10-14)

Status: **OPEN, NO-GO for paid/credited partner conversion settlement**. Source: `src/server/routes/partnerReferrals.ts`, `src/server/partnerReferralCore.ts`, `src/server/partnerReferralService.ts` at main `f423afeb60cdce82a94330b2daf2d3c4a332e512`.

## Current-state correction and P0 evidence (2026-10-29)

**Source refresh:** The paragraphs below marked "observed" describe the historical **2026-10-14** code at main `f423afeb...`; in particular the statement that `recordPartnerConversion` directly sets `rewardStatus: earned` and increments counters is **not true of the reviewed 2026-10-29 PR #201 branch**. Preserve that historical finding for traceability; use this section for the current trust decision.

Reviewed in branch `fix/200-concurrency-fixture-typecheck-20261029`:
- `src/server/routes/partnerReferrals.ts` strictly parses the webhook, validates the campaign slug, checks a per-campaign HMAC signature and timestamp, and applies a distributed limiter. HMAC authenticates a configured key holder, **not a purchase or claimed buyer identity**.
- `src/server/partnerReferralService.ts` performs Firestore transactional consent, account-deletion, campaign and signed-referral binding checks; it records `proofStatus: partner_assertion_only` and `rewardStatus: pending_verification`. No increment of qualified conversions or award of Klar+ follows from this assertion alone. Event ID and buyer claim use stable HMAC-derived document IDs and transactions, subject to real emulator verification.
- `src/server/partnerReferralCore.ts` payload still allows a partner-provided `buyerUid`; this does **not** satisfy independent buyer/purchase proof. P0 #55 remains open even while reward credit is fail-closed.

### Data flow and trust levels (as reviewed)

```text
Klar user --[consent + authenticated session]--> Klar server
    --> Firestore: UID-scoped referral / consent epoch / deletion marker

Partner provider [PARTIALLY UNTRUSTED]
    --[signed webhook: eventId, referralToken, buyerUid]--> Klar HTTP route
       --[syntax, slug, HMAC + freshness, limiter]--> conversion service
       --[transactional eligibility, binding + idempotency]--> Firestore:
              partner_referral_conversions: partner_assertion_only
              partner_referral_buyer_claims: deduplication claim
              partner_referral_ledger: pseudonymous audit evidence
       -X-> qualified reward / paid settlement (blocked without proof)

Independent order/payment/identity authority --> NOT INTEGRATED / NOT VERIFIED
```

**Threats not closed:** compromised or colluding partner who knows the signing key; arbitrary eligible `buyerUid` supplied with a plausible referral token; fraudulent order, refund and chargeback; uncorrelated provider transaction IDs; dispute/reversal processing; secret rotation with old-key revocation; insufficient immutable reconciliation evidence. Existing HMAC and transaction controls address only part of these threats.

### Minimum proof contract before monetized settlement

1. Define an authenticated, time-bounded, single-use **server-issued buyer intent** bound to campaign, authenticated buyer (only pseudonymous to partner), consent epoch, and a random nonce. Validate buyer ownership and deletion status again at settlement.
2. Require an independently verifiable purchase/fulfillment record with immutable provider order ID, order state, amount/product scope as approved by Finance, and attribution to that intent; reject arbitrary `buyerUid` as proof.
3. Commit intent consumption, order deduplication, buyer/campaign reward cap, eligibility state and append-only audit atomically; keep reward pending until settlement finality.
4. Model signed negative/reversal events and refunds/chargebacks, disputes, partner key rotation/revocation, manual segregation of duties and incident recovery. Never delete required legal audit evidence without a reviewed retention/legal basis.
5. Before rollout require independent Security, Privacy/Legal, Finance and Release approval of partner contract, retention, transfer and anti-fraud semantics. This is a design gate, not permission to activate payments.

### Test evidence boundary

- Generic Enterprise CI [40940801484](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/40940801484) passed on `adb4c7b87cafcbd9ff1c3f8d5c6dd54f6eb4bd65`. Dedicated real Firestore emulator test was **skipped** in standard CI and is **UNVERIFIED**.
- Follow-up isolated source commit `e1db5283cef62ce46536d3c5e9d5d4307336e1fe` adds 10 further idempotent replays, self-referral, mismatched slug, missing buyer consent, and raw-UID/token non-persistence assertions. These tests were **not executed against the emulator** during this review; no PASS is claimed.
- Execute the guarded runner on the pinned `demo-klar` project and preserve exact SHA, configured host/port, Node/runtime version, command, UTC time, sanitized logs, exit code, transaction outcomes, and fixture cleanup evidence. No production cloud access or release permission is inferred.

**Decision: P0 #55 OPEN / monetized partner settlement BLOCKED / Production NO-GO.** Do not merge, enable rewards, or deploy based on this document.

---

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
