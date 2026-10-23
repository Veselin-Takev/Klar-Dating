# P1 #53 — Klar+ member invitation rewards: unit economics and decision gates

**Audit snapshot:** 2026-10-23. **Decision: BLOCKED / PRODUCTION NO-GO.**  
**Repository / source:** [Veselin-Takev/Klar-Dating](https://github.com/Veselin-Takev/Klar-Dating), [Draft PR #119](https://github.com/Veselin-Takev/Klar-Dating/pull/119) exact HEAD `7fdf29010c85f16a9b38e5c93186f32e92192f3a` (open, unmerged).  
**Issue:** [#53 — Klar+ member referral economics](https://github.com/Veselin-Takev/Klar-Dating/issues/53), OPEN at inspection.  
**Location:** isolated `docs/ci-governance-audit-2026-10-23` documentation branch.

**Scope and disclaimer:** This is source-backed product/finance discovery and a reproducible **model specification**, not a financial forecast, recorded transaction, live KYC verification, tax/legal advice, code change, approved campaign or security attestation. Inputs for costs, conversions, paid retention and live revenue **have not been supplied or independently validated**. All numbers except inspected existing source constants are **[ANNAHME] / proposed scenario parameters**. No command, test, build, CI run, checkout, refund, webhook delivery, production system, TTL or financial mutation occurred in this audit.

## 1. Current implementation and commercial-source alignment

| Control | Read-only evidence at inspected SHA | Consequence for Issue #53 |
| --- | --- | --- |
| Klar+ product availability | [`src/lib/klarPlus.ts`](https://github.com/Veselin-Takev/Klar-Dating/blob/7fdf29010c85f16a9b38e5c93186f32e92192f3a/phase2_work/src/lib/klarPlus.ts) sets `BUCHBAR=false`; [`src/server/routes/billing.ts`](https://github.com/Veselin-Takev/Klar-Dating/blob/7fdf29010c85f16a9b38e5c93186f32e92192f3a/phase2_work/src/server/routes/billing.ts) returns HTTP **501** when not bookable. [`server.ts`](https://github.com/Veselin-Takev/Klar-Dating/blob/7fdf29010c85f16a9b38e5c93186f32e92192f3a/phase2_work/server.ts) supplies `isBookable: () => BUCHBAR`. | Product currently **must not be marketed or modeled as already purchasable**. Existing Stripe code is a prepared guarded path, not proven cash revenue or delivered benefits. |
| Stripe price in guarded path | [`src/server/stripeService.ts`](https://github.com/Veselin-Takev/Klar-Dating/blob/7fdf29010c85f16a9b38e5c93186f32e92192f3a/phase2_work/src/server/stripeService.ts) defines a **EUR 11.99/month** recurring price (`unit_amount: 1199`) and idempotent checkout reservation, successful-payment/failed-invoice/subscription cancellation webhook logic. | This is a **configured gross consumer checkout price**, **not** demonstrated actual receipt, net margin, VAT treatment, paid-customer retention or monetizable reward value. A reward cannot simply be valued as 11.99 EUR per 30 days without an approved cannibalization and contribution model. |
| False selling-point in prepared Stripe metadata | `stripeService.ts` still passes product description `Maximale Klarheit, erweiterte Filter, keine Werbung.` to Stripe, while `klarPlus.ts` explicitly prohibits selling an ad-free benefit because no ads are delivered; [`tests/klarPlus.spec.ts`](https://github.com/Veselin-Takev/Klar-Dating/blob/7fdf29010c85f16a9b38e5c93186f32e92192f3a/phase2_work/tests/klarPlus.spec.ts) checks the **catalogue** but does not inspect the Stripe product metadata. | **Confirmed source-to-copy inconsistency in a currently gated payment flow.** Before any enablement, remove the misleading ad-free promise from checkout metadata and add tests over the provider payload/consumer disclosures in a separately authorized code PR. No claim that end users currently see the gated metadata. |
| Actual invitations | [`src/server/routes/launch.ts`](https://github.com/Veselin-Takev/Klar-Dating/blob/7fdf29010c85f16a9b38e5c93186f32e92192f3a/phase2_work/src/server/routes/launch.ts) attributes to `referredBy` with `referralQualified:false`, logs `referral_events`, but does not award Klar+ duration. [P0 #48](P0_ISSUE_48_REFERRAL_ZERO_TRUST_DESIGN_2026-10-23.md) finds generator/claim alphabet and idempotent-outcome defects. | Attribution is **not** approved reward qualification; no actual attributable uplift or cost/reward data. Require trusted sign-off and bug resolution first. |
| Identity/KYC trigger | [P0 #48](P0_ISSUE_48_REFERRAL_ZERO_TRUST_DESIGN_2026-10-23.md) specifies verified qualification must derive from the signed Didit authority; member invitation claim must not set `isVerified` or grant perks. | No reward before authorized, deduplicated eligibility. KYC attempts (including failed) may incur cost and therefore must be tracked without inflating user success claims. |
| Partner versus member economies | [`partnerReferralService.ts`](https://github.com/Veselin-Takev/Klar-Dating/blob/7fdf29010c85f16a9b38e5c93186f32e92192f3a/phase2_work/src/server/partnerReferralService.ts) handles a **separate B2B partner** signed callback. New claims remain `pending_verification` with no qualified counter credit. [#57 finance audit](P1_ISSUE_57_PARTNER_REWARDS_REFUNDS_LEDGER_AUDIT_2026-10-23.md) identifies unfinished settlement/reversal. | **Do not** include provider-declared B2B conversions as member invitations, verified revenue, or reward cash generation. Keep independent allocation and ledgers. |
| Contact quota and free promise | Klar+ catalog says **eight initial contacts/day for all plans**, and **no delivered ads**. Issue [#51](https://github.com/Veselin-Takev/Klar-Dating/issues/51) requires an actual one-city supply pilot and truthful suggestions, and [#47](https://github.com/Veselin-Takev/Klar-Dating/issues/47) keeps claims under review. | A benefit **must not** increase daily basic contact quota, remove core Free access, assert ad rewards are active, or promise guaranteed daily verified inventory. |
| Current tests | `tests/billingEndpoint.spec.ts` has route guard/auth/return-URL checks; `tests/klarPlus.spec.ts` covers catalog availability and prohibits advertising as a plan benefit. | Existing source tests **were read, not executed**; no true reward ledger/conversion, cancellation, 7-/30-day extension, cohort or financial reconciliation test is evidenced. |

## 2. Non-negotiable product/compliance principles

1. **Rewards as transparent, finite Klar+ time windows only.** No coins, points, in-app currencies, loot-style mechanics or non-verified status badges. Rewards may not assert KYC completion. Beneficiaries retain genuine core Free access whether or not they refer others.
2. **Do not grant while `BUCHBAR=false` or the financial entitlement path is unapproved.** A marketing promise, historical script or trial coupon cannot bypass the same authoritative subscription/KYC/cancellation controls.
3. **No B2B-to-member entitlement bridge** absent independent Security/Privacy/Finance design approval. External partner purchase claims cannot activate consumer benefits.
4. **Exactly-once durable credits with reversals:** a signed current verified eligibility decision, one immutable qualification record per approved source account and campaign policy, transactionally unique grant, finite start/end, capped re-issuance, and a separate immutable compensating fraud/refund ledger event. Do not subtract paid entitlements or consumer rights due to uncertain provider assertions.
5. **Fail closed on low local supply**: avoid rewarding massive unauthenticated signups while users have insufficient real eligible profiles. Do not create marketing copy claiming guaranteed 8–12 daily recommendations without valid cohort supply.
6. **Financial/Legal/Security/Product must approve commercial liability and consent/retention** under #48/#53/#55/#56/#57/#70 before shadow-mode or actual reward delivery.

## 3. Decision variants: 0 / 7 / 30 days

These are **comparison cases from Issue #53, not authorized rewards**. `0 days` is a truthful nonreward control; `7` and `30` are proposed fixed-duration credit options **after validated qualification**. Exact entitlements, expiry date, usage conditions, cap and disclosure are **[ANNAHME]** subject to approval.

| Variant | User outcome (proposed) | Financial exposure | Primary risk and gate |
| --- | --- | --- | --- |
| **0 days** | No reward granted; existing Free and invitation experience unchanged. | No reward liability; ordinary KYC, infra and support costs still incurred. | Safest initial shadow/control cohort; cannot claim Referral ROI without comparable causal data. |
| **7 days** | One fixed, noncash Klar+ period, only after KYC and anti-fraud qualification. | Incremental infrastructure/features/support plus possible foregone paid margin and dispute loss over real affected periods. | Cost-cap, concurrency/stacking rules and consumer cancellation/expiry disclosures must pass. |
| **30 days** | One fixed, noncash Klar+ period on the same independently proven event. | Potentially greater opportunity cost and prolonged capacity/retention effects. | Stronger upfront Finance approval, measurable conversion uplift and lower bound on incremental contribution before pilot. |

### Model inputs required (no synthetic default rates)

| Symbol | Definition and unit | Required trustworthy source / owner |
| --- | --- | --- |
| `N_i` | Unique eligible sent invitations per pilot cohort and window (count), deduplicated | First-party consented events, Product/Analytics |
| `p_register` | Registered invitee probability among eligible invitees | Cohort events, Analytics/Privacy |
| `p_kyc_attempt`, `p_kyc_pass` | Verified attempt rate and signed approval rate (dimensionless) | Didit signed outcomes and Finance vendor invoices, Security |
| `p_eligible` | Fraud-clean qualification rate conditional on real signed KYC | Security/Fraud decisions, QA |
| `p_paid(d)`, `D7/D30` | Paid conversion and meaningful retention **by reward variant and comparison cohort** | Finance/Analytics, consent and cohort definitions |
| `C_kyc_attempt` | Actual billed KYC costs **per attempt**, including failed/verifications retried | Vendor billing records, Finance |
| `C_infra(d)`, `C_support(d)` | Marginal infrastructure/AI and support expense per eligible reward by duration | Cloud/AI cost exports and support tickets, FinOps |
| `C_fraud(d)` | Expected irreversible fraud/dispute and reversal processing cost | Signed fraud/dispute outcomes and Finance |
| `M_paid` | Verified **net contribution** per paid customer after VAT/refunds/payment fees/variable service expenses over a consistent horizon | Finance-signed books, not raw checkout price |
| `Cannibal(d)` | Foregone net contribution from paid customers who receive free time instead (incremental cannibalization) | A/B experiment and payment cohorts, Finance |
| `V_supply` | Eligible profiles/conversations per launch-city subcohort, including low-density fallback and report rates | Actual privacy-reviewed local inventory, Product |
| `Budget_cap`, `Grant_cap` | Approved maximum **liability cost** and count of benefits, with hard-deny behavior | Finance + Release Owner signed policy |

**Do not equate:** `N_i` (sent invitations) with approved referrals; registrations with signed KYC approvals; approved KYC with retained activated users; partner assertions with paying conversions; Stripe `unit_amount=1199` with net margin; or observed correlation with causal referral lift.

## 4. Reproducible break-even and scenario calculations (worksheet, not an invented forecast)

All quantities for one consistent, observed pilot window and cohort; track events disaggregated by variant `d ∈ {0,7,30}` and normalize to the same eligible invitation denominator. A control or randomized holdout is necessary to distinguish incremental referral lift from organic acquisition and selection bias.

- `N_registered(d) = N_invited(d) × p_register(d)`.
- `N_kyc_attempt(d) = N_registered(d) × p_kyc_attempt(d)`.
- `N_qualified(d) = N_kyc_attempt(d) × p_kyc_pass(d) × p_eligible(d)`.
- `N_granted(d) <= N_qualified(d)` and bounded by policy `Grant_cap`. **[ANNAHME]:** `N_granted(0)=0`.
- `Expected_KYC_cost(d) = N_kyc_attempt(d) × C_kyc_attempt`, **not** only successful KYC attempts.
- `Expected_grant_expense(d) = N_granted(d) × [C_infra(d) + C_support(d) + C_fraud(d)] + Cannibal(d)`. Liability recognition and actual cash cost must be distinguished by Finance, not forced into one number.
- `Net_incremental_contribution(d) = Gross_incremental_customer_contribution(d) - Expected_KYC_cost(d) - Expected_grant_expense(d) - Acquisition_ops(d) - Other_incremental_costs(d)`. Customer contribution is an **incremental cohort lift against control**, not raw paid gross receipts. Ensure nonreward cohort costs are counted consistently.
- `Expected_program_ROI(d) = Net_incremental_contribution(d) / Total_incremental_program_cost(d)`, **only if** denominator is positive and financial accounts have verified numerator/denominator provenance. When missing, report `NOT MEASURABLE` rather than 0 or a fabricated percentage.
- `Break_even` when the lower confidence bound on *incremental customer contribution* exceeds the upper plausible bound on total incremental expense under agreed risk threshold. **[ANNAHME]** requires jointly selected confidence level, horizon and stopping policy.

Record sensitivity *for each* `d`: base, low density, low KYC completion, high KYC retry costs, low paid conversion, high cannibalization, fraud tail, paid cancellation, and zero ad revenue. Stress tests must use observed distributions or explicitly Finance-approved bounds; **no currency amounts or conversion probabilities are invented here**.

### Staged commercial recommendation — pending approval

- **Default / Shadow:** `d=0`, track minimal lawful anonymized/aggregated cohort events and signed KYC cost with no grant or persuasive paid promise. Evaluate city liquidities first (#51).
- **Controlled 7-day hypothesis:** Evaluate only if trial benefit product/compliance/KYC/fraud design has independent approval and a hard total cost/liability cap. Use randomized holdout and test acquisition/retention lift versus cannibalization; no default activation.
- **30-day hypothesis:** Defer until the 7-day or control evidence has sufficient quality and a larger signed financial reserve; do not infer economics solely by multiplying a monthly listed price by 30/30.

## 5. Minimal privacy-safe cohort and finance evidence contract

**Proposed events, not current confirmed telemetry:** `invite_issued`, `invite_opened`, `registered`, `kyc_attempted`, `kyc_approved`, `activated`, `qualified`, `reward_reserved`, `reward_granted`, `reward_reversed`, `paid_upgrade`, `paid_cancelled`, `cohort_d7`, `cohort_d30`. Each must have an approved definition, consent/legal basis, environment, schema version, deduplicated first-party event ID and trusted source. Avoid raw UIDs, emails, biometrics or code/token strings in external analytics. Store financial amounts only with approved access controls and retention.

**Separate financial reporting:** verified gross invoice, VAT/sales taxes, refunds, payment processing, net collectible subscription contribution, variable cost, earned vs settled partner commission, reward-duration liability, uncollectible losses, fraud and support costs. Partner and member rewards must never share an idempotency namespace or claim an unverified cash receipt.

**Reconciliation:** finance books to Stripe/merchant actuals, cloud export to usage, KYC invoices to attempted validations, time-grant ledger to entitlement state, attribution to one verified source, partial/full refunds and cancellations to approved compensating ledger postings. Signed monthly/experiment-cohort reconciliation and breach alerts required before real incentive spending.

**Data rights:** consent withdrawal, Art.17 source/customer deletion, permitted legal holds and international processor handling defined by #56/#70 and DPO; do not persist indefinite personal event streams because model inputs are incomplete.

## 6. Security, finance and product acceptance tests (not executed)

| Scenario | Required outcome | Review owner |
| --- | --- | --- |
| 0/7/30 variants on fake or unverified registrations | No reward before authoritative signed KYC and approved policy; 0-day cohort never grants | Security, QA |
| Ten concurrent claims / events for one invitee | One immutable qualification and at most one reward grant by approved key | Security, QA, Firestore |
| Inviter self-referral, underage, Sybil, blocked account, duplicate family/device fraud | Reject/quarantine according to signed anti-fraud model, no paid benefit | Security, Privacy |
| KYC re-run, false webhook, revoked status, verified then deleted | Re-evaluate state; no grant on stale proof, no resurrection on replay | Security, Didit KYC |
| Existing paid Klar+ and 7-/30-day reward | Preserve paid entitlement and legal cancellation; no accidental double stacking or negative duration | Finance, Legal |
| Grant followed by partial/full refund or abuse decision | Authorized compensating ledger, bounded future benefit; no silent historical record rewrite | Finance, Security |
| Lost acknowledgement and repeated reward fulfillment | Atomic one-time effect, safe retry and signed audit | Backend, QA |
| Cancel/withdraw during trial or right-of-withdrawal window | Appropriate consumer rights and precise displayed start/end dates | Legal, QA |
| Zero local verified supply / no real profile inventory | Pause campaign, truthful fallback; no forced purchases or fictitious profile supply | Product, SRE |
| Low KYC approval + high retry + low paid conversion | Negative contribution correctly reported, budget limit stops new grants | Finance, FinOps |
| High fraud/support cost or cash-collateral shortfall | Suspend spending, reconcile reserve and alert independent owners | Finance, SRE |
| Checkout copy includes disallowed ad-free claim | Provider product description and DE/EN/ES/FR product copy fail claim-gate **before** enabling BUCHBAR | Product, Legal, QA |
| Cohort experiment / privacy | No PII in analytics, one-city stratification, no fabricated baseline, correct attribution vs organic holdout | Privacy, Analytics |
| Integrated project release | Exact-SHA emulator, security scans/CI, reviewer roles, full host evidence and protected production signoffs | Release Owner |

## 7. Human approval / roadmap

1. **Product / Brand:** Approve intended Free/Klar+ benefits and factual copy (#47), choose measurement horizon and cohort size, prohibit paywalling Free invitations, clarify trial expiry and whether 0/7/30 are valid experiments.
2. **Security / KYC (#48):** Fix referral token alphabet, proper idempotent claim outcome, independent Didit qualification, fraud cap, one-time entitlement grant and revocation rules before any reward feature.
3. **DPO / Legal (#56/#70):** Determine lawful event purposes and recipient contracts, full retention/hold matrix and consumer cancellation/advertising claim truth.
4. **Finance / Commercial (#53/#57):** Sign per-attempt KYC invoice cost, real margins/refunds, campaign cap, fraud tail assumptions, funded duration liability, counterfactual CAC, experiment stopping decision and accounting journals. No approved numbers yet.
5. **Product / SRE (#51):** Verify launch-city supply and truthful Free funnel; do not scale referrals into empty cohorts. Confirm metrics delivered and negative-economics alert in authorized staging.
6. **Engineering / QA:** **Only after formal audit unlock**, deliver feature-flagged, default OFF code in dedicated branch; execute local-first security/emulator/KYC/entitlement/billing/E2E cases and exact-SHA CI, with active incident rollback plan.
7. **Release Owner / independent approvers (#8/#73):** Enforce base-branch eligible CODEOWNERS and independent Security, DPO, Legal, Finance, Operations/SRE approvals with `gates.tsv`, 15 logs/`SHA256SUMS`, mapped 14 CI gates/13 integrations and true post-merge exact-main CI before any production GO.

**Final:** P1 #53 remains **OPEN**. No real financial data, approved budget, implemented Klar+ time reward, tests or commercial trial were delivered. This source-only review **does not modify** PR #119, `main`, application code, CI or production. **PRODUCTION NO-GO.**

Related: [#47 claims audit](P0_ISSUE_47_PRODUCT_CLAIM_SOURCE_AUDIT_2026-10-23.md), [#48 member referral zero trust](P0_ISSUE_48_REFERRAL_ZERO_TRUST_DESIGN_2026-10-23.md), [#57 partner finance](P1_ISSUE_57_PARTNER_REWARDS_REFUNDS_LEDGER_AUDIT_2026-10-23.md), [#8 release ledger](ISSUE_8_PRODUCTION_GO_LIVE_GATE_RECONCILIATION_2026-10-23.md).
