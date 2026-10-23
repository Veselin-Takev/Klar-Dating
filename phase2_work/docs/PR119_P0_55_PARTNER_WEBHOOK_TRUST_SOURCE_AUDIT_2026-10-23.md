# P0 #55 — PR #119 partner webhook trust boundary and proof gap (2026-10-23)

**Release: NO-GO / HARD STOP.** Audit-only, cost-free. No production access, paid CI, merge or deployment. Immutable source PR #119: `7fdf29010c85f16a9b38e5c93186f32e92192f3a`; tree `05f22f0ca387ae37573b1f81e85ead901dce3da9`.

## Original source authenticity
The following five exact source/test files were independently compared to the immutable GitHub tree: 
| File (under phase2_work/) | Verified Git blob SHA |
|---|---|
| `src/server/partnerReferralCore.ts` | `1aaf33eb925b15fb47e9da087be16666ec29758d` |
| `src/server/partnerReferralService.ts` | `caac15e4609cd526e47a487a2d6d5f335649995d` |
| `src/server/routes/partnerReferrals.ts` | `77bf44c9e5d5f3d54f1dba7dfb83b8d81d515618` |
| `tests/partnerReferralService.spec.ts` | `bf862cf49ce7240ced0c1d7b0ca7d3eae35f8dd6` |
| `tests/partnerReferralCore.spec.ts` | `cfd101a4b8ef828cc016620df2d5f70d36bd388e` |

**5/5 Git blobs verified** after extracting these files from a local candidate archive. They were not trusted merely because of the archive filename.

## Current-source findings (distinguish from the historical 2026-10-14 memo)
The public webhook accepts a strict `qualified_conversion` payload containing partner-provided `eventId`, `referralToken` and `buyerUid`; HMAC-SHA256 with a partner-slug secret, canonical payload and 300-second freshness authenticate the signer, **not the purchase or buyer**. `recordPartnerConversion` checks the referral token's HMAC-bound owner, campaign and version; rejects self-referrals, mismatched campaign, absent age/consent/consent epoch, pending deletion and inconsistent replay records. A Firestore transaction creates an event and buyer claim.

**Current PR #119 behavior:** New partner assertions are marked `rewardStatus: pending_verification` / `proofStatus: partner_assertion_only`. The inspected conversion function does **not** increment `qualifiedConversions` and does not grant `earned`; the existing fake-Firestore test source includes zero-credit assertions. Earlier historical documentation describing immediate earned rewards is not applicable to this commit.

## P0 gaps remaining (NOT fixed by source quarantine)
- The partner can claim an eligible arbitrary `buyerUid` and event; a valid partner signature does not independently tie an authenticated buyer to an actual paid order. Approval requires short-lived, single-use, server/buyer-authorized purchase intent, genuine order evidence, independently verified fulfillment and anti-fraud policy.
- An **unverified** pending assertion immediately reserves a `partner_referral_buyer_claims` document. Without independently approved expiry, legal-hold, dispute and cancellation semantics, a false claim may block a later legitimate claim, even though no reward was granted.
- Refund/chargeback/reversal and multi-stage verified settlement/ledger accounting are not established in the examined callback path. Both B2B contract and compliance decisions remain unresolved (issues #55, #56, #57).
- Key rotation, 10x replay, forged buyer, tampered slug/campaign, parallel claims, account deletion, independent consent/Art.17 and settlement E2E still need emulator/staging evidence and sign-offs.

## Offline evidence and strict limitations
A **locally tested candidate** script `screen-pr119-partner-webhook-boundary.mjs` and its test file were prepared outside the repository. **27/27 local Node.js 22.16.0 structural tests PASS**, including 23 deterministic negative source mutations, injected unauthorized counter credit, missing source and CLI misuse. The script reads a user-specified verified source snapshot without installing packages, touching the network or changing files. On the exact five verified-source files its structural screen returns exit 0; the JSON **always** says `production_release_decision: NO-GO`, `independently_authenticated_buyer_purchase: false` and `verified_settlement_and_refund_lifecycle: false`. The 27 PASS result is a tooling regression result, **not** 27 app tests or a qualified host gate.

**The checker is NOT integrated in this documentation-only commit**; do not call a missing repository path. It is a static substring screen, not a TypeScript parser or behavioral/economic proof. The existing Vitest test source was reviewed but Vitest, Firestore Emulator, E2E, actual partner callbacks and a real purchase were **not run**.

## Release/ownership
Product, Security, DPO/Legal, Finance and Partner Operations must approve the versioned purchase/attribution and reversal state machine, prevent indefinite unverified claim reservations, prove independent buyer/purchase identity, privacy/retention and fraud remediation; subsequently execute all immutable-host tests, original release gates and four independently authenticated final approvals. Gate 07 Bun/npm policy conflict remains unapproved. **0/15 qualified host gates PASS evidenced, 0/4 final approvals evidenced; P0 #55 OPEN; Production NO-GO.** See https://github.com/Veselin-Takev/Klar-Dating/issues/55.


## 2026-10-23: Static guard integrated, trust-contract decision outstanding

The read-only source checker and **27/27 local mutation tests** are committed **only to the isolated audit branch**; the original five input blobs were verified against PR119 Git tree. A green structural screen does not establish independent purchase proof or user entitlement. The proposed attribution intent, time-bounded provisional claim release, independent purchase verification and refund/reversal lifecycle is documented in `ADR_PR119_PARTNER_PURCHASE_PROOF_CLAIM_REVERSAL_2026-10-23.md`. It is **not approved**, contains no application/schema implementation and does not authorize any host gate. Issue #55 remains OPEN, release NO-GO.
