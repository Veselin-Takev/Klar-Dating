# PR119 P0 #56 — Partner tracking, pseudonymous tokens and Article 17 source reconciliation (2026-10-23)

**Status: SOURCE REVIEW ONLY. PRIVACY APPROVAL MISSING. PRODUCTION NO-GO / HARD STOP.**

Original immutable PR119 commit: `7fdf29010c85f16a9b38e5c93186f32e92192f3a`; original tree `05f22f0ca387ae37573b1f81e85ead901dce3da9`. This is a cost-free read-only audit-branch evidence document. Ten source, test and documentation files taken from an exact-SHA source archive were locally Git-blob hashed and all ten matched the original GitHub tree (**10/10**). This is not proof of cloud behavior, external processors or GDPR clearance.

## Actually observed in the immutable source

| Surface | Source-grounded observation | Risk or evidence not yet established |
| --- | --- | --- |
| `partnerReferralService.ts` consent | `setPartnerConsent` stores `partnerReferralConsent`, version and update time; withdrawal rotates valid consent epoch; invalid epochs can be quarantined | The precise notice, processing purpose, recorded choice and effective external revocation were not independently audited |
| Referral link | Stable HMAC-SHA256 token derived from owner UID, campaign, consent version and secret; 64-character hex handle is used in Klar link | A stable pseudonym may correlate an individual; hashing is not legal anonymisation |
| External destination | `trackedDestination()` performs `url.searchParams.set('klar_referral', token)`; the partner receives the query value on consented tracked visits or owner-open | Partner URL/analytics/server logs, recipient/processor role, international transfer and token retention unapproved |
| Public click | `Cache-Control: private, no-store` and `Referrer-Policy: no-referrer`; untracked direct destination for visitors without required consent, with transactional owner/visitor consent and epoch verification for tracked flow | No-referrer protects referer metadata **not the deliberately transmitted target query**; browser/provider E2E and withdrawal races unverified |
| Conversion + buyer claim | Signed provider assertion is quarantined as `pending_verification` / `partner_assertion_only` and does not immediately grant a reward | Independent buyer/purchase proof, pending-claim release, refunds/chargebacks and lawful retention missing (#55/#57) |
| Art.17 erasure | `trustAndSafety.ts` quarantines owner referrals before buyer-claim purge; sweeps conversion owner/buyer refs, buyer claims, ledger actor/owner/buyer refs and campaign admin references | Code inspection is **not** a completed Firestore Emulator/staging/partner-side erasure or legal-hold proof |
| `DATA_RETENTION.md` §11 | Specifically records conversion/contract financial retention as **open before production**, and documents four rate-limit TTL groups | The approved per-collection retention and live policy state remain unknown (#70) |

## Exact original inputs

The ten original Git blobs were independently matched against the nontruncated GitHub tree `05f22f0ca387ae37573b1f81e85ead901dce3da9`:
`src/server/partnerReferralService.ts`, `src/server/routes/partnerReferrals.ts`, `src/server/partnerReferralCore.ts`, `src/server/trustAndSafety.ts`, `src/server/partnerReferralDeletion.ts`, `src/components/PartnerReferralWidget.tsx`, `docs/DATA_RETENTION.md`, `tests/partnerReferralService.spec.ts`, `tests/partnerReferralDeletionEmulator.spec.ts`, `src/server/consentAudit.ts` (all relative to `phase2_work/`).

A separate read-only **local candidate** `scripts/screen-pr119-partner-privacy-boundary.mjs` and 30 mutation/input regressions were tested. Result: **30/30 PASS** on local **Node 22.16.0**; when screened against externally Git-verified PR119 sources the tool reports 10/10 structural markers and exits **1 / NO-GO** by design. It states `source_integrity_proven_by_this_tool=false`; do not use it to authenticate a checkout, purchase, GDPR compliance or any mandatory host gate. **The candidate code and tests are local only, not committed as part of this documentation commit.**

## Required approvals and independent evidence (all currently MISSING)

1. DPO/Legal: Verzeichnis der Verarbeitungstätigkeiten including lawful Art.6 basis **per purpose**, recipient/processor and geographic transfer, special-category Art.9 and Art.35 DPIA/DSFA screening as applicable.
2. Product/DPO/Security: Versioned consent notice, recorded proof of deliberate partnertracking consent and refusal/withdrawal, revocation and old-token handling across browsers and partner systems.
3. Security/Partner/DPO: Independently test query-token visibility in external browser, redirect, logs, analytics and sub-processors; document legal/contractual safeguards and assess a short-lived single-use opaque exchange intent.
4. DPO/Finance: Binding retention and legal-hold matrix for referral, conversion, buyer claim, ledger, campaign, dispute and contractual records; erasure exceptions must be documented and approved.
5. DPO/SRE: Actual emulator and scoped stage Art.17/consent E2E, concurrent conversion/deletion race, restart and processor erasure evidence, approved live TTL inventory, privacy notice and data-subject rights.
6. Security, DPO/Legal, SRE and Release Owner: Independently authenticated final signoffs linked to the exact immutable target and versioned source/contract scope.

External legal context: the [EDPB pseudonymisation clarification](https://www.edpb.europa.eu/news/edpb-adopts-pseudonymisation-guidelines-and-paves-the-way-to-improve-cooperation-with_en) says re-attributable pseudonymised data remain personal data. [GDPR official text](https://eur-lex.europa.eu/eli/reg/2016/679/oj/eng) Articles 5, 6, 9, 17, 30 and 35 apply as appropriate; this audit does **not** determine any eventual legal basis or DPIA requirement.

**Do not close P0 #56. No application code, Firebase rules, Cloud state, partner contract, CI, paid service, main or PR119 was changed. Mandatory Enterprise host gates 0/15 evidenced; four final independent approvals 0/4 evidenced; Gate07 contract still unapproved. PRODUCTION NO-GO.**
