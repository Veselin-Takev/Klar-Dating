# Klar Enterprise — Issue #57: Partner reward liability, refunds and ledger lifecycle

**Audit snapshot:** 2026-10-23. **Decision: BLOCKED / PRODUCTION NO-GO for monetized partner conversions and rewards.**  
**Repository:** Veselin-Takev/Klar-Dating; **source:** [Draft PR #119](https://github.com/Veselin-Takev/Klar-Dating/pull/119) at exact HEAD `7fdf29010c85f16a9b38e5c93186f32e92192f3a` (unmerged).  
**Issue:** [#57 — B2B reward and billing lifecycle](https://github.com/Veselin-Takev/Klar-Dating/issues/57) (open at review).  
**Work location:** documentation-only `docs/ci-governance-audit-2026-10-23`, separate from release branches and `main`.

**Method and limitations:** Direct read-only GitHub source and checked-in test/document inspection. No genuine financial transaction, external partner purchase, settlement, Stripe event, refund, Firestore Emulator, Cloud read, CI, test, code modification or governance approval was performed. A proposed data model, ledger or signoff below is **not** implemented or legally approved; no release GO follows from this audit.

## 1. Current source facts: avoid stale-issue false positives

| Control | Exact source observation | What is NOT established |
| --- | --- | --- |
| Campaign reward offer | [`partnerReferralCore.ts`](https://github.com/Veselin-Takev/Klar-Dating/blob/7fdf29010c85f16a9b38e5c93186f32e92192f3a/phase2_work/src/server/partnerReferralCore.ts) accepts `rewardLabel` (display text) and `termsSummary`. [`partnerReferralService.ts`](https://github.com/Veselin-Takev/Klar-Dating/blob/7fdf29010c85f16a9b38e5c93186f32e92192f3a/phase2_work/src/server/partnerReferralService.ts) stores `rewardLabel`, `qualifiedConversions`, and signed partner audit events. | A label is not an enforceable SKU, priced obligation, provider responsibility, actual entitlement, approved reward period, earned invoice or funding source. |
| New provider conversion | [`recordPartnerConversion`](https://github.com/Veselin-Takev/Klar-Dating/blob/7fdf29010c85f16a9b38e5c93186f32e92192f3a/phase2_work/src/server/partnerReferralService.ts) validates signed-provider assertion and buyer/referrer eligibility/consent, then transactionally inserts a claim with `rewardStatus:'pending_verification'`, `proofStatus:'partner_assertion_only'`. It does **not increment qualified conversion counters**, mark `earned`, or issue rewards from new claims. | HMAC confirms message authenticity from a partner key holder, not an independently verified purchase or a liability. The originally reported immediate `earned` path in issue #57 was mitigated **for new events in this Draft HEAD**. |
| Replay prevention | Derives hashed IDs from event ID and campaign and reserves one per-campaign buyer claim; event binding plus current consent/epoch checks prevent some conflicting or stale duplicate acknowledgments. Separate audit key is stable across partner signing-key rotation. | Actual Firestore concurrency semantics, replay-after-settlement state handling, independent purchase ID/order uniqueness or partial refund policy are **not proven**. |
| Partner API | [`routes/partnerReferrals.ts`](https://github.com/Veselin-Takev/Klar-Dating/blob/7fdf29010c85f16a9b38e5c93186f32e92192f3a/phase2_work/src/server/routes/partnerReferrals.ts) exposes campaign administration, consent, links, clicks, and the signed `qualified_conversion` callback. The strict payload schema allows `event`, `eventId`, `referralToken`, `buyerUid` only. | **No refund, chargeback, cancellation, settlement, payout, fulfillment or reward reversal endpoint in the inspected router/payload schema**. Do not overstate this as repository-wide proof that no other administrative settlement system exists. |
| Stripe subscriptions | [`stripeService.ts`](https://github.com/Veselin-Takev/Klar-Dating/blob/7fdf29010c85f16a9b38e5c93186f32e92192f3a/phase2_work/src/server/stripeService.ts) implements idempotent Stripe subscription billing events, payment failure and subscription cancellation. | These are **direct Klar subscription-billing records**, with no observed join to independently verified partner order or reward liability in the inspected partner flow. Do not grant partner rewards from an unrelated Stripe payment/cancellation. |
| Historical conversion state | [`PARTNER_CONVERSION_PENDING_PROOF_2026-10-14.md`](https://github.com/Veselin-Takev/Klar-Dating/blob/7fdf29010c85f16a9b38e5c93186f32e92192f3a/phase2_work/docs/PARTNER_CONVERSION_PENDING_PROOF_2026-10-14.md) says previously recorded `rewardStatus:'earned'` and counted conversions are **not retroactively migrated**. | No independently authenticated historical inventory, source reconciliation, partner dispute adjudication, refunds or compensating balance migration has been supplied. Do not silently rewrite old earned records. |
| Existing tests | [`tests/partnerReferralService.spec.ts`](https://github.com/Veselin-Takev/Klar-Dating/blob/7fdf29010c85f16a9b38e5c93186f32e92192f3a/phase2_work/tests/partnerReferralService.spec.ts) contains a fake-Firestore test for pending status, zero qualified counters, event binding, duplicate acknowledgement and malformed stored claim. | These are **checked-in test definitions**, not executed test receipts or proof of real Firestore isolation, independent buyer/order proof or actual reward issuance. |

## 2. Findings and severity

| ID | Finding | Recommended gate |
| --- | --- | --- |
| `P57-01` | New partner assertions are quarantined in source rather than immediately earned: **a genuine defensive improvement** over the historical issue report. | **Preserve fail-closed quarantine**; do not reactivate earlier direct-award behavior. Exact-SHA source/emulator validation remains pending. |
| `P57-02` | `rewardLabel` is free-form campaign copy, not a type-safe financial or bounded Klar+ entitlement promise. | Product/Finance/Legal sign a canonical offer contract defining payer, liability, fulfillment party, time period, cap, expiry, withdrawal/refund policies, governing terms and taxes. |
| `P57-03` | No independently verified buyer/order/payment-finality binding before eligibility or money-related states in the inspected conversion flow. | **Hard P0 dependency #55:** only a separately trusted purchase source and approved buyer intent may create financial eligibility. Pending assertions remain non-payable. |
| `P57-04` | No source-shown independent partner conversion settlement, commission receivable or reward cost accounting; `qualifiedConversions` counter is not a financial ledger. | Design versioned financial obligations with proper event-based reconciliation, idempotent posting, separating partner receivable from Klar reward liability, and a signed source chain. |
| `P57-05` | No approved `fulfilled`, `failed`, `reversed` lifecycle or refund/chargeback and partial refund event schema in the inspected partner router. | Create typed, authenticated, replay-safe state transitions with compensating entries and two-person review for exceptional adjustments, rather than editing status/ledger history. |
| `P57-06` | Legacy `earned` events and historical counter values were not migrated; new `pending_verification` events might be reported together with legacy earned data. | Quarantine legacy financial reporting until independently reconstructed, signed Finance-approved reconciliation and buyer/partner disputes resolve each source. |
| `P57-07` | Existing partner buyer-claim key appears scoped to campaign slug + buyer and prevents a second buyer claim for that campaign. This is not an approved repeat-order policy. | Product/Finance must decide one qualified purchase per campaign vs permitted repeat purchases **before** changing uniqueness keys or releasing rewards. Use stable order-level immutable IDs after independent purchase proof. |
| `P57-08` | Partner financial audit data, reversal evidence, token references and erasure/legal-hold requirements overlap P0 #56 and #70. | Approve per-record GDPR legal basis, retention schedule, participant rights and narrow lawful exceptions **before** new bookkeeping or TTL policies. |
| `P57-09` | Klar+ catalog source describes `BUCHBAR=false` and disables unverified checkout claims. | **Do not promise paid membership or reward access** until independently authorized entitlement grants, cancellation protection and real user acceptance prove the benefit. |
| `P57-10` | Contractually attributable commission/reward amounts, net cash flow, fraud/support cost and partner settlement receipts are absent from inspected partner conversion schema. | Finance-owned unit economics and loss-exposure limits required before monetized pilot; do not invent prices, margins or VAT/tax treatment. |

**Risk classification:** P1 functional completeness within issue #57; **P0 hard dependencies** #55 (purchase authenticity), #56 (processing legal basis), #70 (retention), plus release #8. No financial event, payment, liability or reward balance can be approved by this static analysis.

## 3. Proposed versioned state machine — design only

Maintain two **separate ledgers** and authorities:
- **Conversion / proof:** `partner_asserted -> pending_verification -> buyer_bound -> purchase_verified -> qualified`; alternate `rejected` / `expired` / `quarantined` statuses.
- **Benefit fulfillment:** `qualified -> pending_fulfillment -> fulfilled` or `failed`; a previously recognized qualified/fulfilled order can receive `refunded`, `partially_refunded`, `disputed` or `reversed` adjustments under an explicit approved compensation contract.
- **Financial accounting:** invoice/partner commission **receivable**, actual settlement **cash**, and awarded but unconsumed Klar+ time **reward liability** are distinct; a pending provider claim is none of these. If actual accounting requires a payable cost or accrued obligation, the Finance owner specifies the recognition point and journal entry.

**Authority:** Never infer `purchase_verified` from the same partner's unchecked callback or a webhook signature alone. Require an authenticated buyer-bound checkout/session proof plus separate PSP/merchant-ledger corroboration with threat assessment. A second partner-controlled signature is **not independent** proof. Finance/Legal must define acceptance for real merchant-specific evidentiary documents.

**Exactly-once grant:** A qualified immutable source order, campaign/policy version and beneficiary UID must bind to a unique idempotency key and transactionally written grant record and entitlement update. Independent retry/outbox delivery may be at-least-once but the **effect** must be once-only. No grant on missing consent, deleted/banned account, incomplete KYC, disputed purchase or revoked campaign.

**Reward type:** Klar's customer rewards are **bounded Klar+ periods** (not coins, points or money). The **exact duration, cap, qualifying activity, eligibility and payout responsibility are [ANNAHME / NOT APPROVED]**. No currency-based reward should be introduced as an internal user balance. If a third-party discount/voucher is contemplated by commercial contract, evaluate separately with Product/Legal/Finance and do not describe it as an already activated Klar entitlement.

**Reversal:** Financial corrections are **append-only compensating events** with source reference, reason, signed approvers and reversible/irreversible benefit policy. Dispute a pending amount rather than subtracting from unrelated users. Do not mutate existing earned events or produce negative user balances by decrementing already consumed Klar+ time. Separate future benefit revocation from lawful historical financial adjustments; account and reward ledger records must be consistent under retries.

**Cancellation/payment races:** Independently paid Klar+ periods and free base features must not be reduced because a partner asserted a refund. Require period-source attribution and an approved user-rights policy, including EU subscription cancellation and refund. Do not let stale webhook retries resurrect canceled/refunded reward periods or previously deleted accounts.

## 4. Finance-owned data contract proposal — NOT implemented

| Domain | Minimum fields to approve (not concrete schema or deployed defaults) | Auditor |
| --- | --- | --- |
| Partner order proof | Independent order/payment reference hash, partner ID, merchant/PSP verifier, buyer-authorized attribution intent, campaign version, order timestamps, signature/provenance, refundable scope | Security, Partner Finance |
| Conversion claim | Existing immutable event binding, per-buyer/campaign unique claim, proof state, consent epoch, verified decision reference | Security, DPO |
| Partner settlement ledger | Immutable transaction ID, offer/policy and product identifier, amounts in signed **minor currency units**, currency, commission receivable, settlement/payout ID, VAT/tax decision, chargeback source, approved Finance reviewer | Finance/Tax, Legal |
| Klar+ reward entitlement | Authorized beneficiary UID, bounded reward source, start/end and granted duration, capped policy, grant/reverse event IDs, exact subscription/entitlement reconciliation and user notification | Engineering, Product, Finance |
| Reward accounting and support | Immutable source receipts, reward liability balance classification, settled/reversed/failed totals, fraud/support costs, exact audit signature/retention class | Finance, SRE |
| Release evidence | Candidate SHA, real processor sandbox/prod environment, complete logs, hashed receipts, role approvals and protected records outside repo | Security, QA, Release Owner |

**[ANNAHME / commercial decision required]:** Define who bears reward cost under partial refunds, if a consumed Klar+ period must be grandfathered, when an accrued liability starts, what to do with uncollected commission and how many qualifying orders per buyer/slug are allowed. No tax/legal accounting statement is asserted as the governing rule without Finance/Legal signoff.

## 5. Required negative and integration tests (future only)

| Scenario | Must assert | Evidence level |
| --- | --- | --- |
| Partner signing key valid, fabricated purchase or wrong buyer | Quarantine only, never verified/credited/fulfilled | Real partner/PSP sandbox + Firestore emulator |
| Ten identical callbacks with same event ID | One pending assertion, zero reward grants and counters until genuine verification | Concurrency / emulator |
| Two order IDs, same buyer/campaign | Enforced approved single-order/repeat-order policy, no duplicate grant or ledger corruption | Concurrency |
| Change buyer UID or referral token for event ID | 409/conflict and evidence quarantine, never rewrite original ledger | API / emulator |
| Purchase verification latency or timeout | Retry-safe pending status, no compensation or grant without proof | Integration |
| Supplier reconciliation conflicts with PSP source | Hold/quarantine and alert; no earnings or fulfillment | Finance sandbox |
| Fulfillment request retry after lost response | Single grant, single finite period, no double stacking | Entitlement emulator |
| Underage, unverified, deleted, revoked consent, banned, self-referral | No qualification/grant, no late refund giving expired identity access | Security/KYC + emulator |
| Full refund before grant | No credit/liability recognized; correct compensating records if something was provisionally posted | Billing sandbox |
| Full refund after grant | Authorized reversal/benefit policy, no negative duration, preserved legitimate paid entitlement | Billing + entitlement |
| Partial refund and chargeback with dispute resolution | Correct proportional/nonproportional Finance policy, idempotent compensation and release after adjudication | Finance/QA |
| Refund and award concurrently | Serializable final state, replay safe, no intermediate double benefit or missing ledger entry | Genuine Firestore emulator |
| Source key rotation after original assertion | Stable identity and replay semantics, no accidental new accrual | Security |
| Legacy earned records/counters and missing source evidence | Quarantine for signed Finance reconciliation, not auto-pay/auto-delete | Migration dry-run and signed report |
| Manual overrides | Real four-eyes Security/Finance signoff; denial of self-approval; logged adjustments | Admin security |
| Accounting close / financial reconciliation | Commission receivable, collected cash, earned-benefit liability, refunds and support/fraud loss all traceable, no unsupported recognized conversion | Finance |
| GDPR Art.17 / retention/legal holds | Field-level signed matrix, erasure or lawful scope-limited retention, no cross-user orphan references | DPO/Legal + real emulator |
| Deployment and rollback | Exact-SHA CI, safe feature flag default OFF, staging metrics, negative tests and controlled rollback | SRE + Release Owner |

**Do not rerun legacy fake-Firestore tests and claim production success**; even if they eventually pass at an authorized SHA, they cannot stand in for an external trusted purchase/settlement proof, financial integration, or immutable human signoff.

## 6. Delivery order after formal governance unlock

1. **Business contract and fraud/privacy approvals:** Product + Finance + Legal define offer semantics (period-only Klar rewards), one-order policy, merchant liabilities, returns/refunds, cost cap, tax and invoice treatment, safe customer disclosures and legitimate retention. Security/DPO approve purchase-origin trust and buyer consent/token minimization. Dependencies #55/#56/#70 are gating.
2. **Design on dedicated feature branch:** Add a versioned proof and accounting contract to the existing quarantined flow; no parallel unaudited API. Build transaction-bound state transitions, unique source grant and compensating ledger entries. All cost-bearing actions remain behind a **default-OFF** protected enablement.
3. **Test local-first:** Pinned Node 22.23.3 / Bun 1.4.2; true Firestore emulator concurrency, PSP/merchant sandbox, fake/expired signed callbacks, delivery retries, partial/full refunds, KYC/revocation, data deletion/holds, exact-SHA gated security scans, customer/finance reporting.
4. **Finance/SRE review:** Independent reconciliation of historic `earned` events and counters, immutable snapshot and partner settlements; authorized dual-signoff for material manual corrections. Proof of cost metrics (net commission, CAC, per-benefit liability, cost of uncollectible claims and fraud/support) and explicit stop limits.
5. **Release governance:** Acquire authentic host bundle (`gates.tsv`, 15 logs, `SHA256SUMS`, toolchain and signer attestations), 14 mandatory gates + 13 integrations, proper CODEOWNERS/role approvals; separate merge readiness from exact-main successful full CI and final protected production GO. **Never turn on payments/benefits under the current NO-GO**.

## 7. Financial and risk reporting template — sources required, no invented figures

Every report must distinguish:
- `partner_asserted_count` versus `independent_verified_orders` versus `eligible_qualified_orders` versus `fulfilled_benefits`; default pending assertions to **zero earned**.
- Gross agreed commission (not booking), invoices issued, **cash collected**, refunds/chargebacks, net earned commission under signed accounting policy; do not infer values from `qualifiedConversions`.
- Outstanding Klar+ duration commitments by source policy and issued/consumed/reversed status; estimate expense/liability only from Finance-approved assumptions, not commercial copy.
- Fraud events, denied claims, support handling costs, stale provider assertions, partner data-right requests, audit retention and unknown/unverified records.

No financial amounts, historical count values or real legal retention periods were obtained by this audit.

## 8. Final independent approval record

**P1 #57:** OPEN / design and financial evidence NOT VERIFIED.  
**P0 #55:** partner assertion remains quarantined pending independent purchase verification.  
**P0 #56 / #70:** lawful basis, complete signed retention/holds and live staging proof not verified.  
**Release #8:** authentic host attestation and independent Security/DPO/Legal/SRE/Finance/Release Owner approval missing.  
**PR #119:** Draft, unmerged at inspected SHA. **PRODUCTION NO-GO.**

Related: [P0 #55 Trust Audit](P0_ISSUE_55_PARTNER_CONVERSION_TRUST_AUDIT_2026-10-23.md), [P0 #56 Privacy Audit](P0_ISSUE_56_PARTNER_PRIVACY_RETENTION_AUDIT_2026-10-23.md), [P0 Release Evidence Register](P0_RELEASE_EVIDENCE_TRACEABILITY_2026-10-23.md), [Issue #8 Release GO/NO-GO](ISSUE_8_PRODUCTION_GO_LIVE_GATE_RECONCILIATION_2026-10-23.md).
