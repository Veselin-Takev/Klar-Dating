# ADR: P0 #55 partner purchase proof, provisional buyer claims and reversals — 2026-10-23

**Status: PROPOSED / UNAPPROVED. Production: NO-GO / HARD STOP.** Baseline PR #119 `7fdf29010c85f16a9b38e5c93186f32e92192f3a`, tree `05f22f0ca387ae37573b1f81e85ead901dce3da9`.

## Confirmed implementation, not proof of purchase

The reviewed `POST /partner/webhook/:slug` validates strict provider event structure, per-slug HMAC, freshness (~300 s) and uses rate limits. `recordPartnerConversion` checks self-referrals, token-bound campaign/owner/consent epoch, eligible accounts, deletion status and transactional event/buyer-claim deduplication. **New partner assertions are saved as `pending_verification` / `partner_assertion_only` without incrementing qualified counters or granting rewards.** Five source/test blobs matched the immutable GitHub tree; 27/27 static mutation tests passed on **nonqualified Node 22.16.0**. This is not an actual purchase, identity, Firestore Emulator or production gate test.

A partner may still *assert* `buyerUid` and `referralToken`. HMAC proves possession of a secret, **not** buyer permission, purchase, fulfillment, payment finality or rightful reward. A preliminary buyer claim is currently reserved despite unverified evidence. P0 #55/#56 and P1 #57 remain open.

## Proposed buyer and order trust protocol — not implemented

1. Only a **Klar-authenticated buyer action**, with explicit purpose-specific consent, may create a single-use, short-lived server-side purchase/attribution intent. Bind a random opaque nonce to the buyer's pseudonymous reference, campaign, specific offer, attribution/consent epoch, issue and expiry, and the authenticated action. No raw buyer UID, private profile or long-lived identifying query parameter may be disclosed to the partner.
2. A provider-signed callback is **only an assertion**. Verify a scoped immutable external order identifier, partner identity, intent nonce binding and allowed event semantics, then corroborate fulfillment using an independently approved source (for example, authenticated server-to-server status and buyer confirmation). A signature or claimed buyer UID alone never qualifies.
3. Use idempotent transactions and immutable audit entries for one-time consumption of intent and order identifiers. Verify authentic provider key versions and rotation, timestamp/replay window, order/campaign/offer equality, consent withdrawal, account deletion and fraud checks. Never allow repeated or conflicting partner assertions to overwrite a prior claim.
4. Track separate **purchase verification**, **financial finality** and **Klar+ reward fulfillment**; Klar+ time periods are the only user-facing reward. Partner financial records and statutory obligations require their own lawful accounting; no invented credits, coins or automatic settlement.

## Proposed claim/reward state transitions (not approved schema)

| Current | Authoritative trigger | Next | Side effect |
|---|---|---|---|
| none | signed partner assertion | `assertion_pending` | Provisional claim only; no reward or qualified counter |
| `assertion_pending` | buyer-bound intent plus independently verified order evidence | `purchase_verified` | Immutable proof reference; no payout |
| `purchase_verified` | product/finance eligibility and settlement finality | `settlement_eligible` | Permits separately authorized fulfillment |
| `settlement_eligible` | exactly-once Klar+ entitlement grant with audit receipt | `fulfilled` | Entitlement and finance reconciliation |
| any provisional | missing proof, invalid intent, timeout, revocation or dispute | `quarantined` or `rejected` | No credit; supervised resolution |
| `fulfilled` | independently authenticated refund/chargeback/fraud | `reversal_pending` then `reversed` or `manual_review` | Audited compensating event, no silent deletion |

A timeout must not permanently lock a buyer: require DPO-approved bounded provisional retention, transactional generation/epoch-safe claim release, renewed eligibility checks and a fraud-dispute appeal path. **No retention duration or automatic TTL cleanup is approved here.** Legal holds and required finance records must not be purged by a generic expiry worker. Do not automatically migrate or revoke historical `earned` records without Product/Legal/Finance approval.

## Mandatory negative and positive acceptance evidence

- Forged buyer UID; unrelated/expired/replayed nonce; consent withdrawal; buyer deletion; wrong partner, campaign or offer; stolen/rotated key; tampered order proof; self-referral; fabricated fulfillment.
- Tenfold duplicate callback, concurrent double-claim, claim-reservation exhaustion, multiple purchase IDs, buyer appeal, partial transaction failure and idempotent crash recovery.
- Refund before grant, partial refund, chargeback after grant, merchant cancellation, reversal double-apply, historical records and second-person administrative correction.
- Privacy threat analysis (referer/log leakage, controller-processor roles, Art.17 deletion, proof retention/legal hold); firewalled provider integration, emulator concurrency, E2E, stage/recovery and qualified host tests with immutable evidence.

**Required approvals:** Product for offer/reward terms; Security for buyer/order binding and key management; DPO/Legal for purposes, retention and Art.17; Finance for entitlement settlement/reversal; SRE for monitoring/recovery and partner contract-version migration. The previous application-remediation HARD STOP requires **new explicit authorization** before product-code or API changes. The user authorizes cost-free audit/documentation only. Mandatory host gates **0/15 evidenced**, final independent approvals **0/4**; Gate 07 contract still unresolved. **NO-GO.**

References: GitHub issues [#55](https://github.com/Veselin-Takev/Klar-Dating/issues/55), [#56](https://github.com/Veselin-Takev/Klar-Dating/issues/56), [#57](https://github.com/Veselin-Takev/Klar-Dating/issues/57).


## P1 #57 cross-reference (2026-10-23)

An exact comparison of original PR119 conversion code versus `docs/PARTNER_REFERRAL_SYSTEM.md` found a **stale `earned` claim** in the system description; the audit branch now documents the actual `pending_verification`/`partner_assertion_only` state and no immediate Klar+ grant. Detailed financial liabilities, idempotency, controlled refund/chargeback compensation and required Product/Finance/Legal approvals are tracked in `PR119_P1_57_PARTNER_REWARD_SETTLEMENT_DECISION_2026-10-23.md`. This is **proposal only**, not authorization to change API, accounting or settlement behavior. Release NO-GO.
