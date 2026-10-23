# P0 Issue #48 — Member Invitation Zero-Trust Design & Static Code Audit

**Snapshot:** 2026-10-23 · `Veselin-Takev/Klar-Dating` · [PR #119](https://github.com/Veselin-Takev/Klar-Dating/pull/119) HEAD `7fdf29010c85f16a9b38e5c93186f32e92192f3a` (Draft, unmerged).  
**Issue:** [#48 — Zero-trust identity, abuse and Klar+ reward gates](https://github.com/Veselin-Takev/Klar-Dating/issues/48) · **status: OPEN / NOT RELEASE-APPROVED**.  
**Scope:** Static repository inspection and proposed architecture / test plan only; **not** an executed CI, emulator, KYC, payment or production audit.  
**Isolation:** Work belongs to `docs/ci-governance-audit-2026-10-23`. No program code, CI workflow, runtime, live credential, release manifest, PR #119 or `main` is changed by this report. The existing governance lockdown takes precedence over implementation.

## 1. Current source contract (verified by direct read at exact HEAD)

- [`src/server/routes/launch.ts`](https://github.com/Veselin-Takev/Klar-Dating/blob/7fdf29010c85f16a9b38e5c93186f32e92192f3a/phase2_work/src/server/routes/launch.ts): `GET /api/referral` requires an authenticated UID, a configured HTTPS `publicUrl`, generates/stores `users/{uid}.referralCode`, returns `shareUrl`; `POST /api/referral/claim` requires a UID, validates `^[A-Z0-9]{10}$`, looks up inviter `users` by `referralCode`, rejects the requesting UID itself, and in a Firestore transaction stores `referredBy`, `referralQualified:false`, plus `referral_events/{inviterUid}_{inviteeUid}` with `status:'attributed'`. Rate limits on generation and claims are keyed by authenticated UID.
- [`src/server/platform/launchPlatform.ts`](https://github.com/Veselin-Takev/Klar-Dating/blob/7fdf29010c85f16a9b38e5c93186f32e92192f3a/phase2_work/src/server/platform/launchPlatform.ts): `referralCodeFor(uid)` uses `HMAC-SHA256(REFERRAL_CODE_SECRET, uid)` and returns `digest('base64url').slice(0, 10).toUpperCase()`. Missing or <32-character secret fails closed.
- [`src/components/LocalLaunchWidget.tsx`](https://github.com/Veselin-Takev/Klar-Dating/blob/7fdf29010c85f16a9b38e5c93186f32e92192f3a/phase2_work/src/components/LocalLaunchWidget.tsx): authenticated non-anonymous UI exposes share via navigator.share or clipboard; no reward occurs in this component.
- [`src/lib/AuthContext.tsx`](https://github.com/Veselin-Takev/Klar-Dating/blob/7fdf29010c85f16a9b38e5c93186f32e92192f3a/phase2_work/src/lib/AuthContext.tsx): registered client attempts `/api/referral/claim` with stored `klar_referral_code` and deletes the saved code for **any HTTP `response.ok`**, without checking an attribution outcome field.
- [`src/server/verification/diditKyc.ts`](https://github.com/Veselin-Takev/Klar-Dating/blob/7fdf29010c85f16a9b38e5c93186f32e92192f3a/phase2_work/src/server/verification/diditKyc.ts) is the existing signed identity authority; `referral`/claim paths do not set `isVerified`.
- [`src/server/routes/partnerReferrals.ts`](https://github.com/Veselin-Takev/Klar-Dating/blob/7fdf29010c85f16a9b38e5c93186f32e92192f3a/phase2_work/src/server/routes/partnerReferrals.ts) implements **different** consent-backed B2B partner flows. It must remain a separate trust and accounting domain.
- [`tests/launchEndpoint.spec.ts`](https://github.com/Veselin-Takev/Klar-Dating/blob/7fdf29010c85f16a9b38e5c93186f32e92192f3a/phase2_work/tests/launchEndpoint.spec.ts) covers malformed code and missing public URL but the examined file contains **no positive generated-code-to-claim round-trip** or concurrent conflicting inviter test. [`src/server/platform/launchPlatform.test.ts`](https://github.com/Veselin-Takev/Klar-Dating/blob/7fdf29010c85f16a9b38e5c93186f32e92192f3a/phase2_work/src/server/platform/launchPlatform.test.ts) tests one deterministic code with `^[A-Z0-9]{10}$`, not all inputs.
- [`src/server/trustAndSafety.ts`](https://github.com/Veselin-Takev/Klar-Dating/blob/7fdf29010c85f16a9b38e5c93186f32e92192f3a/phase2_work/src/server/trustAndSafety.ts) deletes `referral_events` on inviter/invitee deletion. A future reward ledger/claims data model needs its own comprehensive Art.17 treatment, including surviving `referredBy` references and lawful retention exceptions.

These are **observed static code paths**, not evidence of deployed behavior or independently verified data consistency.

## 2. New source-level defects and risk analysis

| Finding | Root cause / exact contract | Consequence and remediation requirement | Classification |
| --- | --- | --- | --- |
| **REF-01 — Generated code may fail claim syntax** | Producer emits **Base64url**, whose valid alphabet includes `-` and `_`; consumer accepts only `A-Z0-9`. Uppercasing does **not** eliminate `-`/`_`. | Valid generation can produce a persisted/shareable code that the claim endpoint rejects with HTTP 400. Adopt one explicitly versioned, testable, URL-safe **and validator-compatible alphabet**, validate both ends and include a generated-code round-trip regression. Never change a legacy encoder without a compatibility/migration plan. | **Confirmed source incompatibility; runtime incidence not measured** |
| **REF-02 — Success asserted on transactional no-op** | Within the claim transaction, an existing `referredBy` or a changed inviter code causes an early return, yet the API unconditionally answers `{ok:true}`. `AuthContext` clears its saved code on any 2xx. | Same-inviter retry may be a valid idempotent success; conflicting inviter/rotated code must be **distinguished** from it. Return explicit `claimed`/`already_claimed_same`/`conflict`/`expired` outcomes and only clear the client code on the applicable verified result. Bind to an explicit target identity; never falsely grant/reward. | **Confirmed control-flow defect; business impact conditional** |
| **REF-03 — Stable unversioned invitation code** | Code is a deterministic truncation of HMAC(secret, UID); current invited-user record contains no `codeVersion`, expiry, explicit revoke time or dedicated issuance record in inspected paths. | Secret rotation may invalidate outstanding invitations; a shared code may remain indefinitely actionable while valid. Specify controlled revocation, key versioning, issuance expiry and token migration before reward launch. | **Architecture gap, not a demonstrated exploit** |
| **REF-04 — Attribution is not verified qualification** | Claim stores `referralQualified:false`, `status:'attributed'`, not a verified KYC event or an actual Klar+ entitlement. | Attribution must not grant `isVerified`, entitlements, partner conversion or paid benefits. A separate server-owned eligibility service and reversible time reward ledger are needed. | **Known incompleteness of planned Referral 2.0** |
| **REF-05 — Authorization/eligibility checks insufficient for future rewards** | Claim route checks authenticated UID, malformed code and inviter != invitee; it does **not in the examined flow** confirm guest/non-guest, age, consent, identity approval, invite issuance state, sanction/block state or campaign policy. Client's `isAnonymous` check is not a server authorization. | Harden server-owned eligibility **before** adding reward issuance, protect account deletion races and blocked users, ensure legacy attribution remains compatible only when lawful. | **Missing requirements for new reward functionality** |
| **REF-06 — Privacy and lifecycle edge cases** | `referral_events` contains `inviterUid` and `inviteeUid`. Deletion flow removes events by both fields, but deletion of an inviter does not, from the inspected code, prove removal of every surviving invitee's `referredBy` value. | Validate a full ownership graph across member attribution, users, claim receipts, ledger, retention/holds and pseudonymized audit artifacts; deletion of either party and withdrawal must suppress future processing/rewards where required. | **Deletion completeness requires emulator proof** |

**Not proven:** active exploitation, production exposure, user-level impact counts, full repository-wide test absence, a live payment or qualified reward. Do not translate static findings into broad operational PASS/FAIL claims.

## 3. Approved-design proposal (requires Product/Security/Privacy/Finance decision)

### 3.1 Identity and state boundaries

`issued -> visited -> registered -> verified -> qualified -> rewarded` with explicit terminal/side states `expired`, `revoked`, `rejected`, `quarantined`, `reversed`.

| Transition | Only valid trigger / authority | Hard invariant |
| --- | --- | --- |
| `none -> issued` | Registered authenticated issuer + server issuance transaction | Random high-entropy secret-free public token, hashed/token-ID lookup only; fixed issuer UID, version/expiry, abuse caps. An HMAC-derived opaque code is also possible with versioned rotation; do not expose the UID. |
| `issued -> visited` | Idempotent first-party landing event | No identity proof, qualification or reward; ignore bot preview/scanner events. Consent/legal basis before nonessential tracking. |
| `issued/visited -> registered` | Server-confirmed non-anonymous registration + anti-self-invite transaction | One invitee attribution globally, UID+invite version immutable, deterministic idempotency key, no reuse across accounts. |
| `registered -> verified` | **Only signed Didit KYC authority** on current account/session | `isVerified` never written by invitation; revocation overrides cached qualification. |
| `verified -> qualified` | Server rule engine, fraud checks, adult/legal/consent state, eligible cohort, approved policy | Requires actual eligibility and independent review of anti-abuse thresholds, not merely observed KYC. |
| `qualified -> rewarded` | Transactionally unique grant from authoritative subscription/entitlement service | Reward is a **bounded Klar+ period** only, never currency/coins; exactly-once ledger + unique `inviterUid:inviteeUid:campaignVersion` key, max caps, start/end, audit and chargeback/reversal path. |
| `* -> revoked/expired/rejected/quarantined` | Account owner or authorized risk/legal expiration controls | No future attribution/reward; define reversible vs terminal semantics, precise retention, minimal forensic data. |
| `rewarded -> reversed` | Authorized fraud/chargeback/reconciliation, with required two-person control when material | Append-only compensating ledger record, never erase audit trail unlawfully; entitlement state and legal holds reconciled. |

No transaction may use a caller-controlled `isVerified`, `rewarded`, `qualified`, `inviterUid`, `buyerUid` or time credit as authority. Enforce separate B2B service namespaces and secrets.

### 3.2 Data and trust contracts — proposal, not committed schema

- `member_invites/{inviteId}`: opaque derived token hash, `inviterUid`, `version`, `createdAt`, `expiresAt`, `revokedAt`, `campaignPolicyVersion`, `status`; approve per-collection TTL **only after** legal/retention review. Never store the raw share code.
- `member_invite_claims/{inviteeUid}`: unique canonical claim; inviter binding, immutable claim time, issuance ID and evidence pointer; transactionally read the inviter issuance document, invitee status and claims record.
- `member_reward_ledger/{idempotencyKey}`: unique source event, benefit `klarPlusDuration`, period, status `pending/awarded/reversed`, source KYC decision ID, policy version, bounded audit fields. Append compensating reversal; enforce finite-duration entitlement and no unintended stacking.
- `member_invite_outbox/{eventId}` **if justified**: durable event retries for eligible KYC/reward state; exactly-once grant enforced in storage regardless of queue duplicates.
- Keep member invitation entities separated from existing `partner_referral_*` entities. Do not migrate or share partner conversion secrets.

**[ANNAHME / POLICY DECISION REQUIRED]**: Exact expiry periods, qualifying activity, Klar+ duration, cap, local-city eligibility, consent basis, finance ROI and legal hold conditions are not yet approved; do not select numeric defaults as deployed facts.

### 3.3 HTTP contract — backward compatibility and fail closed

- `GET /api/referral`: permit read/issuance only for allowed users; versioned URL and expiration indicator; no sensitive token/body logs, `Cache-Control: no-store`, approved public-origin allowlist; return a proper revoked/expired result.
- `POST /api/referral/claim`: parse **the same alphabet** as the issuer; reject invalid syntax **before** lookup; enforce verified token, issuance status, account eligibility, self-invite and same-candidate identity. Run all conditional writes transactionally. Return a typed outcome:
  - `201 {status:"claimed"}`: new successful claim.
  - `200 {status:"already_claimed_same"}`: idempotent retry, same registered invitee and original inviter.
  - `409 {code:"attribution_conflict"}`: conflicting prior claim, never report success.
  - `410 {code:"expired_or_revoked"}`: not actionable; avoid leaking personal identity through response differences where public-facing enumeration is possible.
  - `401/403` for unauthorized/disallowed accounts; `429` for abuse limits; `503` for uncertain store state. Do not silently convert transaction no-op to 2xx.
- Client `AuthContext` clears stored code **only** on the two successful, semantically verified claim statuses; preserve recoverable transient errors without cross-account replay. Abort/clear on logout/UID change; never claim for unverified or deleted account.
- Do not activate new entitlement/reward code until #47 claim matrix, #48 security architecture, #56 legal basis and #8 production readiness are formally accepted.

## 4. Required tests (future execution only; no tests executed here)

| Test | Expected outcome | Test layer |
| --- | --- | --- |
| Deterministic code generation over representative and property-based UIDs | Every emitted code matches the claim validator's alphabet and round-trips to intended inviter | Node unit + API emulator; fix one-UID test blind spot |
| Explicit `-` / `_` code and legacy tokens | Historical valid code handled by approved compatibility path or explicit migration; new issuer never creates unclaimable code | Contract regression |
| Self-referral | Rejected, no state/credit | Emulator |
| Anonymous / unauthenticated / underage / KYC pending | No qualification or credits, no circumvention via client | API/emulator |
| Duplicate identical claim (10+ replays) | Same-inviter idempotent result, one canonical claim | Firestore emulator |
| Same invitee claims two different codes concurrently | At most one winner, loser receives conflict, one write/one ledger decision | Firestore emulator |
| Inviter revokes/rotates code during claim | No stale claim accepted, no misleading `ok:true`, no credit | Transaction race |
| Wrong or expired issuance / malicious token mutation | No attribution, bounded generic error | API tests |
| Signed KYC approve / revoke / replay | Only KYC can set `isVerified`; benefit not repeated and revoked qualifications reconsidered | Signed webhook + emulator |
| Deleted invitee / inviter, Art. 17 / legal hold | Cross-document linkage removed or lawfully retained according to approved policy; no orphan credited claims | Erasure emulator |
| Rewards threshold, cap, refund, fraud reversal | One finite Klar+ grant and unique compensating reversal; no stacking bypass | Emulator + entitlement billing integration |
| No consent, stale session, account switch | Suppress unlawful tracking and stale reward; no credential/user leaks | E2E, privacy |
| Preview bots, enumeration/rate limits and key rotation | No qualification on visit, abuse blocked; rotation/version controls work | Threat/contract tests |
| Member vs B2B domain isolation | B2B signed conversion cannot mint member reward, member token cannot authorize partner endpoint | Integration/E2E |

The [existing endpoint test file](https://github.com/Veselin-Takev/Klar-Dating/blob/7fdf29010c85f16a9b38e5c93186f32e92192f3a/phase2_work/tests/launchEndpoint.spec.ts) currently mocks referral code as `'ABCDEFGHIJ'` and tests malformed input; this does not exercise the actual HMAC Base64url character edge case. The [single-UID generator test](https://github.com/Veselin-Takev/Klar-Dating/blob/7fdf29010c85f16a9b38e5c93186f32e92192f3a/phase2_work/src/server/platform/launchPlatform.test.ts) asserts `^[A-Z0-9]{10}$` for one fixture, insufficient as a generator/consumer invariant.

## 5. Gate owners and release sequence

1. **Product/Brand/Legal (#47):** Define truthful invitation copy, real Free promise, eligibility, non-manipulative Klar+ benefits, approved localized messages.
2. **Security/Architecture (#48):** Approve versioned token design, threat model, UID/registration/KYC authority, key rotation, rate limits, enumeration/replay and entitlement service ownership.
3. **DPO/Legal (#56/#70):** Approve lawful basis/consent, data map, cross-account deletion, retention periods, third-party sharing and hold exceptions **before** any TTL writes.
4. **Engineering/QA:** Implement in a dedicated non-release feature branch **only when lockdown lifted**, write unit/real Firestore and Playwright negative tests, run full pinned Node 22.23.3/Bun 1.4.2 local-first and source-SHA CI.
5. **Finance/SRE/Release Owner (#8, #53):** Verify monetary exposure, cap/rollback, auditability, actual CI/monitoring/operational evidence and independent signatures. No reward launch or production merge until GO.

**Gate outcome today:** `BLOCKED / NO-GO` — no tested code correction, no official Issue #48 closure, no evidence of successful P0/P1 or authorized release. This report is a static acceptance artifact only.

Related: [P0 #47 source audit](P0_ISSUE_47_PRODUCT_CLAIM_SOURCE_AUDIT_2026-10-23.md), [P0 issue traceability](P0_RELEASE_EVIDENCE_TRACEABILITY_2026-10-23.md), [host-evidence intake](CI_HOST_EVIDENCE_INTAKE_RUNBOOK_2026-10-23.md).
