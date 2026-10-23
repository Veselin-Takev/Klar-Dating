# P0 #55 — Partner conversion authenticity, buyer binding, and settlement trust audit

**Snapshot:** 2026-10-23 · Repository: `Veselin-Takev/Klar-Dating`  
**Inspected code:** Draft [PR #119](https://github.com/Veselin-Takev/Klar-Dating/pull/119), exact HEAD `7fdf29010c85f16a9b38e5c93186f32e92192f3a` (not merged).  
**Issue:** [#55](https://github.com/Veselin-Takev/Klar-Dating/issues/55) · **OPEN / NO-GO for monetized B2B conversions**.  
**Branch:** `docs/ci-governance-audit-2026-10-23` (documentation-only).  
**Evidence strength:** static source reading, inspection of committed *test source* and historical design records. **No test executed and no live partner, Cloud, PSP, Firebase emulator, credential or consent records inspected.** This document cannot authorize a deployment, merge, CI retry, purchase recognition or release GO.

## 1. What the current code actually proves, and what it cannot

This source snapshot is **newer than the initial #55 issue and the first 2026-10-14 trust-boundary document**. Do not carry forward an obsolete assumption that every signed provider assertion immediately earns a paid reward.

| Area | Specific source-backed implementation | Limit / release consequence |
| --- | --- | --- |
| Envelope/authenticity | [`PartnerConversionPayloadSchema`](https://github.com/Veselin-Takev/Klar-Dating/blob/7fdf29010c85f16a9b38e5c93186f32e92192f3a/phase2_work/src/server/partnerReferralCore.ts) accepts strictly `event:'qualified_conversion'`, `eventId`, 64-hex `referralToken`, `buyerUid`; the endpoint validates a campaign-specific HMAC and a **300-second** timestamp window. | Authenticates a **partner-key holder's message**, not the sale, buyer's purchase intent, order validity or actual user consent at purchase time. An attacker controlling a signing key can still assert invented values. |
| Authorization and attribution | [`recordPartnerConversion`](https://github.com/Veselin-Takev/Klar-Dating/blob/7fdf29010c85f16a9b38e5c93186f32e92192f3a/phase2_work/src/server/partnerReferralService.ts) checks referral-token/owner/campaign/version binding, campaign status and slug, owner/buyer age and present partner consent/epochs, deletion records, self-referral and transaction consistency. | Buyer UID still originates in a partner-controlled callback. **Independent buyer-to-sale binding is absent** in inspected conversion route. A current-consent check is not in itself authenticated consent and attribution at the actual sale. |
| Replay and key rotation | Stable audit key (not rotating webhook secret) derives event IDs, buyer claim keys and assertion binding; duplicate path checks source binding and persisted links; inconsistent legacy events fail closed. | Good source control against simple replay and key rotation. Still **not** purchase authorization, fulfillment proof or a complete fraud model. Secret compromise and historical corrupted records require incident/migration process. |
| Award boundary | New event and buyer claim are written transactionally with `rewardStatus:'pending_verification'` and `proofStatus:'partner_assertion_only'`; qualified counters are **not incremented**, no verified reward is issued in this path. | **A defensive quarantine exists at this HEAD.** Do not describe the source as immediately paying partner assertions. `201 {ok:true, rewardStatus:'pending_verification'}` acknowledges **quarantined receipt only**, not a confirmed sale. |
| Historical records | [`PARTNER_CONVERSION_PENDING_PROOF_2026-10-14.md`](https://github.com/Veselin-Takev/Klar-Dating/blob/7fdf29010c85f16a9b38e5c93186f32e92192f3a/phase2_work/docs/PARTNER_CONVERSION_PENDING_PROOF_2026-10-14.md) states historic `earned` events/counters are not automatically migrated or reclassified. | Historic balances and externally consumed API contracts require separate verified reconciliation. **Do not rewrite paid history without audit and Finance authorization.** |
| Tests available in source | [`tests/partnerReferralService.spec.ts`](https://github.com/Veselin-Takev/Klar-Dating/blob/7fdf29010c85f16a9b38e5c93186f32e92192f3a/phase2_work/tests/partnerReferralService.spec.ts) includes mock-Firestore pending/no-counter/duplicate and inconsistency tests; [`tests/partnerReferralCore.spec.ts`](https://github.com/Veselin-Takev/Klar-Dating/blob/7fdf29010c85f16a9b38e5c93186f32e92192f3a/phase2_work/tests/partnerReferralCore.spec.ts) covers HMAC freshness and tampering. | These are **test files inspected, not results executed in this audit**. Fake-Firestore tests do not establish concurrency guarantees, deployed proxy behavior, PSP authenticity, real callbacks or operating controls. |

## 2. Findings and evidence classification

| ID | Risk / gap | Classification | Why still OPEN |
| --- | --- | --- | --- |
| `P55-01` | Signed provider controls `buyerUid`; consented real UID can be named without proof that this UID originated the purchase. | **Confirmed trust-contract gap** | HMAC and same-UID consent checks cannot independently bind buyer/account to a real order. |
| `P55-02` | `qualified_conversion` request event name versus `pending_verification` response; `ok:true` acknowledges persistence, not paid qualification. | **Confirmed semantics mismatch / consumer risk** | All downstream consumers, dashboards, partner agreements and legacy `earned` records must distinguish `partner_asserted` from `independently_verified` and `settled`. No current consumer misuse is inferred without inspection. |
| `P55-03` | No inspected independently authenticated purchase ID, merchant/PSP settlement finality, buyer-origin nonce or authenticated attribution-intent verification before conversion becomes eligible. | **Confirmed missing end-to-end proof in this path** | Quarantine is intentionally incomplete; paid conversion authorization cannot be derived from vendor possession of signing secret. |
| `P55-04` | Current payload has no refund, cancellation, dispute, partial refund or reversal event. | **Confirmed schema scope gap** | Finance-approved reversal lifecycle and bounded retention must exist before crediting monetary benefits. |
| `P55-05` | Partner assertion replay protected via stable event/buyer keys; however cross-order uniqueness, historic earned migration, key-compromise containment and reconciliation are unverified. | **Partly implemented / operationally unverified** | Do not claim missing idempotency entirely: source already enforces one event ID and a per-campaign buyer claim. The exact future multi-order policy needs approval; current buyer claim intentionally reserves one buyer per slug. |
| `P55-06` | Referral token directly passed as `klar_referral` in external partner URL; linking/pseudonymization and data-subject rights remain legally open. | **Related P0 #56 privacy blocker** | `Referrer-Policy:no-referrer` does not prevent the parameter itself from reaching the partner or its logs. No automatic TTL or deletion decision without approved holds. |

**Non-finding (must retain):** Source already gates new assertions as `pending_verification`; source code alone does **not** show an immediate pending-event payout or increment. Explicitly preserve that quarantine while assessing authorized future settlement.

## 3. Threat model / trust-boundary map

```text
Klar authenticated adult member A             Third-party partner (partially trusted)
   |                                                |
   |-- consent/version & invite issued by Klar ------|  public scoped attribution link
   |                                                |
Klar visitor / alleged buyer B                      |-- external destination and checkout
   |                                                |-- partner asserts eventId, buyerUid,
   |                                                |   referralToken over signed callback
   |                                                v
   |                                     Klar webhook ingress (HMAC + time window)
   |                                                |
   |                                   strict schema, token/referrer/consent
   |                                                |
   |                                   atomic pending claim + audit only
   |                                                |
   +-- REQUIRED future authenticated buyer-intent --+-- REQUIRED separate order/
         verification / agreed purpose                    payment/fulfillment proof
                        |                                   |
                        +---- reconciliation under approved risk model
                                        |
                              qualified -> settled (future only)
                                        |
                              reversal on refund/fraud
```

Boundaries: (1) public landing/click; (2) registered visitor identity; (3) partner ingress; (4) Klar authoritative database; (5) independently authenticated purchase proof; (6) Financial ledger/entitlement; (7) privacy, audit and operational signoff.

**Attack cases requiring testing:** dishonest partner signs forged buyer UID; stolen provider key; callback for wrong campaign or token; reordered/scrubbed event IDs; consent withdraw/regrant between click, sale and callback; self-referral; 10+ duplicate callbacks; parallel claims; deleted party; refund after settlement; compromised/cancelled original payment; legacy `earned` record and reprocessed event; adversarial callback with mismatched merchant/order.

## 4. Proposed future-proof contract (not implemented / not approved)

**[ANNAHME: subject to Product/Security/Finance/DPO/Legal approval]** A time-bound, one-time **Klar-issued buyer attribution intent** can link an authenticated, consented eligible visitor, a specific campaign/offer and an approved callback session. Store the intent as a server-owned, expiring, idempotent record; expose only a limited, opaque partner-facing reference. Validate against current buyer consent epoch, account deletion, campaign revocation, attribution issuance and authorized buyer confirmation. **Do not expose a raw Klar UID in partner URLs or trust the partner's supplied UID as self-authenticating identity.**

**Separate purchase authenticity:** Require a contractually specified order/transaction reference with independent corroboration appropriate to the seller (e.g. an authorized PSP/merchant-ledger verification channel whose trust does not collapse into the same unverified partner assertion). Explicitly validate order uniqueness, seller, campaign/offer, transaction finality and authorized buyer attribution. **A second signature from the same dishonest party, by itself, is not independent proof.**

**Versioned state machine:**

`partner_asserted -> pending_verification -> buyer_bound -> purchase_verified -> eligible -> settled`; side states `quarantined`, `rejected`, `expired`, `reversed`.

- Never change existing `pending_verification` into `eligible` on a timer, absence of error, repeat callback, or HMAC alone.
- Accept a compensating refund/chargeback/reversal transition only after authenticated event and double-entry/idempotency verification. Append corrective records; preserve lawful evidence with approved retention.
- Require a stable unique `{partnerId, externalOrderId, eventType}`/authorized intent binding (exact format to be decided), with transaction-safe duplicate and conflict discrimination. Do not reuse provider signing key as the sole identity for persistent idempotency.
- Separate server-owned `buyer`/intent domain from raw provider UID assertions and B2B partner claims; do not conflate P2P member rewards under #48.
- Existing `partner_referral_buyer_claims` currently prevents a second attributed conversion per same buyer/slug; assess the desired one-purchase versus repeat-purchase business model **before** changing the key, and prove migration/compatibility.
- Verify legal basis, explicit purpose, privacy notices, erasure exceptions and audit redaction before introducing new collections, expiry fields or foreign references.

## 5. Required exact-SHA acceptance/negative tests — not run in this audit

| Case | Expected correct result | Required environment |
| --- | --- | --- |
| HMAC missing, wrong, expired or modified body | `401`/reject; no claim, no settlement | HTTP/integration |
| Valid partner HMAC, fictitious buyer UID on genuine account | At most quarantined assertion; **never** buyer-bound, eligible or settled | Real Firestore emulator + independent intent proof |
| Wrong campaign slug / referral token binding | Reject, zero credit | HTTP + emulator |
| Simultaneous callbacks for same event and same buyer across events (10+) | Exactly one allowed pending assertion per approved policy; conflicts fail; no duplicate credits | Real emulator concurrency |
| Webhook signing-key rotation and old event replay | Approved rotation accepted/denied according to policy; stable idempotency preserved | Emulator/security |
| Deleted, underage, self-referred, or consent-withdrawn buyer/owner | Reject or quarantine, no credit | Emulator |
| Consent regrant changes epoch while event pending | Old epoch never becomes newly authorized by later consent | Emulator |
| Malicious inconsistent/tampered historical conversion or claim | Quarantine / explicit review, not silent duplicate acknowledgment | Emulator/migration |
| Refund/partial refund/chargeback after verified purchase | Authorized, unique compensating reversal; entitlement and accounting consistent | PSP/partner sandbox, emulator |
| Missing purchase confirmation, untrusted merchant reference or forged intent | Never mark eligible/settled | External proof contract tests |
| Merged/delayed/cancelled operations; partner retry after timeout | Preserve idempotency, audit, ordering and legitimate recoverability without extra settlement | Real emulator / integration |
| Two-person manual correction + ledger audit | Unauthorized single-person correction denied; signed irreversible trace for authorized adjustment | Admin/role tests |
| Consent + Art.17 deletion incl. legal holds | Full scoped cascade and retention exceptions; no relinking via pseudonyms | Emulator + DPO-reviewed matrix |
| Actual deployed secure headers, webhook proxy, provider sandbox and alert delivery | Verified end-to-end on authorized staging/production and pinned SHA | Real integration and SRE evidence |

Retain existing mock tests as fast regression checks. **They cannot replace real concurrent Firestore emulator tests or trusted external purchase corroboration.**

## 6. Human decisions and dependencies before coding/GO

1. **Security & Product (#55):** Approve threat model, explicit vendor/buyer authentication contract, key compromise plan, event semantics and compatibility/migration of the existing `qualified_conversion` callback and `pending_verification` response.
2. **DPO/Legal (#56, #70):** Decide purpose/consent, controller/processor roles, buyer UID sharing, processing register, third-party token/link/log treatment, retention/legal holds and verified deletion. Obtain written approval before TTL or new collections.
3. **Finance (#57, #53):** Approve transaction proof/finality, eligibility, per-campaign policy and buy-side reward economics; manual reconciliation of historical earned/counter records; refunds/chargebacks and ledger reversals.
4. **Engineering/QA:** After formal lockdown release, implement on a **dedicated feature branch**, add negative tests plus genuine Firebase transactions/provider sandbox, complete pinned local-first gates and exact-commit CI without skipping P0.
5. **SRE/Release Owner (#8, #73):** Confirm CI runner, CODEOWNERS, authorized reviewers, operational alerts, partner incident response, release controls and independent exact-SHA signoffs. A success response for `pending_verification` is not a payable invoice or production GO.

## 7. Evidence and immutable audit rules

For every test/decision: capture candidate commit SHA, named identity and role, origin, time in UTC, exact command/test case, binary/toolchain versions, environment/project, individual exit code, complete immutable result log hash, legitimate independent signer/provenance and expiry/revalidation conditions. Public repository documentation may link to approved access-controlled evidence, **never publish raw secrets, sensitive buyer IDs or identifiable partner logs**.

The existing [host-evidence intake runbook](CI_HOST_EVIDENCE_INTAKE_RUNBOOK_2026-10-23.md) still requires the formal **15 host logs versus 14 source-gate reconciliation**, integrity checks and independent approvals. No cryptographic host bundle has been verified in this audit. Release remains **BLOCKED / NO-GO**.

Related sources: [Issue #55](https://github.com/Veselin-Takev/Klar-Dating/issues/55), [Issue #56](https://github.com/Veselin-Takev/Klar-Dating/issues/56), [previous boundary decision](https://github.com/Veselin-Takev/Klar-Dating/blob/7fdf29010c85f16a9b38e5c93186f32e92192f3a/phase2_work/docs/PARTNER_CONVERSION_TRUST_BOUNDARY_2026-10-14.md), [previous quarantine decision](https://github.com/Veselin-Takev/Klar-Dating/blob/7fdf29010c85f16a9b38e5c93186f32e92192f3a/phase2_work/docs/PARTNER_CONVERSION_PENDING_PROOF_2026-10-14.md), [P0 evidence register](P0_RELEASE_EVIDENCE_TRACEABILITY_2026-10-23.md).

**Source-only conclusion:** quarantine mechanism is observable in code; independently verified sale attribution, final settlement, reversal, real test execution and official production approval are **not established**. Issue #55 remains open.
