# P0 #55 / #56 — Partner Conversion Trust Boundary and Privacy Audit
**Audit date:** 2026-10-30 · **Candidate ancestor:** `66facb790b823505d4ac6db8c0deb7cdd1e4fd20` (stacked draft #212) · **Decision:** BLOCKED / NO-GO

## 1. Scope, evidence classification and non-claims
Reviewed repository files: `src/server/routes/partnerReferrals.ts`, `src/server/partnerReferralCore.ts`, `src/server/partnerReferralService.ts`, `tests/partnerReferralService.spec.ts`; open issues [#55](https://github.com/Veselin-Takev/Klar-Dating/issues/55) and [#56](https://github.com/Veselin-Takev/Klar-Dating/issues/56).

**Source-confirmed:** the route accepts a `qualified_conversion` provider assertion with `eventId`, `referralToken` and `buyerUid`; checks timestamped partner HMAC; executes a Firestore conversion transaction; validates consent/age/owner/campaign state and immutable dedupe/buyer-claim bindings. New conversions are `pending_verification`, with ledger event `partner_conversion_asserted` and proofStatus `partner_assertion_only`; provider HMAC **does not** independently validate real purchase, the buyer's external identity or post-purchase refund status. Unit tests already cover repeated events, revoked consent, misbound buyer, self-referral and no automatic earned reward; these tests are not independently certified production evidence.

**Unverified:** provider authenticity as a business entity, purchase provenance, buyer identity binding, contractually enforceable events, secure partner-side signing key custody, signed receipt proofs, real reconciliation/refunds, production redirection data transfers, browser third-party logging, Art.17 end-to-end stage proof and legal approvals. No access to live customer events or partner contracts was used.

## 2. Data flow and trust boundaries
1. **Klar member, first party:** user consent, account state and server-owned Firebase UID. Token derivation and click/redirect occur under first-party controls.
2. **Link crossing into partner domain:** `klar_referral` attribution token enters a third-party URL and potentially browser history, server access logs, CDN/analytics logs or further redirects. Referrer policy mitigates incidental referral disclosure but **not** disclosure from the destination query itself.
3. **Untrusted partner assertion:** external HTTPS POST with timestamp/HMAC to `/api/partner/webhook/:slug`. A verified HMAC proves that the signer possesses an allowed secret, **not** that a purchase occurred, is finalized, was paid, is unrefunded or belongs to the asserted Klar UID. A compromised provider secret increases fraud and injection risk.
4. **Klar server transaction:** validates signature, server-owned account and consent state, campaign, referral, event/buyer claim idempotency. Persists a quarantined assertion only.
5. **Independent reconciliation / credit:** cannot grant rewards, paid balances or externally report verified conversions until supported purchase proof, buyer binding, policy and independent verification are approved.

## 3. Attack scenarios and mandatory closure
| Scenario | Existing source control | Missing independently verified proof |
|---|---|---|
| Forged buyerUid with correctly signed HMAC | Valid-user/consent checks; pending-only | Provider purchase-bound account linking, binding proof, negative synthetic case |
| Signing key compromised | Scoped per-campaign secret and five-minute signature window | Rotation/revocation evidence; secure vault/least privilege; stale-key rejection |
| Repeat event or concurrent duplicate | Event ID binding, buyer claim transaction | Real Firestore emulator parallel 10× replay and alternative buyer/referral mutation |
| Fake completed purchase or refund/chargeback | No earned reward on assertion alone | Independent payment/order receipt verification, refund state and dispute lifecycle |
| Third-party token leakage | HMAC token, no-referrer | Consent/legal basis for transfer, short-lived exchange tokens if required, redacted browser/CDN/provider log proof |
| Consent withdraw/delete between redirect and callback | Consent/version checks and quarantine | Staged race tests, Art.17 cascade / exclusions and non-resurrection verification |
| Unexpected partner slug / rate-limit abuse | Distributed limiter; source-level slug validation in route | Proof invalid requests cannot cause unbounded Firestore activity or bypass limiter; review existing dedicated fix branch before new change |

## 4. Decision-gated enterprise acceptance matrix
- [ ] **Partner identity and contract:** named accountable provider; independent confirmation of invoice/order semantics, charge capture, reversals, retention and breach notification; legal/controller roles documented.
- [ ] **Buyer linkage:** server-authorized transaction proof bound to the correct user and campaign without accepting provider-chosen Klar UID as sufficient identity evidence. Prefer minimal, time-bounded partner order reference and cryptographically bound opt-in session; do not invent a provider integration.
- [ ] **Provenance:** verify event source and receipt status using partner-provided supported trust mechanism / signed server-to-server verification; check real payment finality and refunds. A legitimate HMAC is not enough.
- [ ] **Adversarial tests:** forged UID, wrong campaign, changed referral token, duplicate event ID, 10+ parallel requests, key rotation, replay beyond timestamp window, consent withdrawal and regrant, minor/deleted users, self-referral, refund, partial network failure and tampered persisted state.
- [ ] **Privacy:** record of processing activities, DPIA screening (not a presumption of DPIA), lawful basis per field and purpose, consent records, processor/controller agreements, privacy notice, third-country transfer review, user access/export/deletion. Treat stable pseudonymous token references as personal data wherever linkable.
- [ ] **Retention:** DPO-approved per-collection periods, hold/finance exception handling, TTL configuration and proof of ACTIVE policies in each authorized target; enforce idempotent cascade deletion and audit without raw buyer UID in durable conversion ledger.
- [ ] **Operations:** rate-limit and distributed-billing load test, fraud alerts, reconciliation queue, 2-person exception approval, bounded retries, on-call routing, full rollback and incident runbook.
- [ ] **Release:** link SHA-pinned test artifacts and staging evidence to issues #55/#56/#8 and obtain independent Security, DPO/Legal, SRE, Product/Finance and Release Owner signoffs. No auto-GO from static or emulator PASS.

## 5. Gate and operational safety
**Do not** modify production partner secrets, create test buyer orders against real users, replay callbacks to production, rotate keys, consume extra CI budget without reason, merge stacked PRs or certify partner credit as verified. Keep pending assertions non-rewarding until signed proof and business acceptance exist. Retain frozen PR #119 and RC R2, leave main untouched.

The CI run [#41030654750](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/41030654750) on ancestor `66facb790b823505d4ac6db8c0deb7cdd1e4fd20` completed/success. This is **not** verification of an actual provider purchase or live GDPR compliance. This report only is committed on an isolated documentation branch, without opening a new PR or triggering additional Actions. **PRODUCTION BLOCKED / NO-GO.**

## 6. New real Firestore emulator regression — branch test/55-partner-conversion-replay-emulator-20261030
- File: `tests/partnerConversionConcurrencyEmulator.spec.ts`, scoped to `demo-klar` and an explicitly checked local Firestore emulator port. It **skips** outside emulator mode and fails closed against production, unexpected projects or durable fallback.
- Seeds isolated synthetic campaign, owner, buyer and alternative buyer; sends **two concurrent identical provider assertions** and **10 sequential replay attempts** to the real `recordPartnerConversion` service/Firestore transaction, then verifies exactly one persisted event/buyer claim, one `partner_conversion_asserted` audit record, and no earned reward or `partner_conversion_verified`.
- Attempts replay of the same event with a different buyer and checks `partner_event_id_conflict`; withdraws the buyer's consent and asserts that subsequent retries fail `conversion_not_eligible`. Cleans up synthetic fixtures and any campaign-bound audit records.
- **Status: newly authored, not yet independently executed.** Exact-head CI must show this test's execution (not skip), no `ABORTED` transaction contention failures, and all Enterprise gates PASS before marking it verified.
- It does **not** prove an external provider's purchase evidence, real buyer identity binding, production partner contracts, legal basis, Art. 17 Stage rollout or receipt/chargeback finality. Issues #55/#56 stay P0 and **NO-GO**.
- Avoid duplicating the existing malformed-slug / shared-IP limiter tests already in draft [#195](https://github.com/Veselin-Takev/Klar-Dating/pull/195), which is independent of this stacked candidate. Plan controlled deduplication/cherry-pick only after cross-branch review.
