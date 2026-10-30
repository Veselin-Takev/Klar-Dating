# ADR (PROPOSED): Atomic member-referral code ownership and legacy migration

**Date:** 2026-10-30  
**Issue:** P0 [#48](https://github.com/Veselin-Takev/Klar-Dating/issues/48), release [#8](https://github.com/Veselin-Takev/Klar-Dating/issues/8)  
**Decision:** **NOT ACCEPTED — design / release gate only. Production BLOCKED / NO-GO.**  
**Source snapshot:** Draft [PR #218](https://github.com/Veselin-Takev/Klar-Dating/pull/218) at `263ea6c0111eeeb496d8dfc6acd95b8c9d305d7c`. This ADR is isolated documentation; it does not modify any runtime collection, rules, data, or running service.

## Context and evidence

The member-referral code is currently a deterministic ten-character uppercase Base64url prefix of an HMAC over Firebase UID (`src/server/platform/launchPlatform.ts:referralCodeFor`). It is not a globally unique reservation key. Existing server endpoints read/write `users/{uid}.referralCode`; claims resolve `users.where('referralCode','==',code)`. Draft fixes progressively enforce permanent Firebase identity and UID agreement (#214/#218), correct same-owner idempotence (#215), reject ambiguous ownership at claim time (#216), and reject an *already existing* foreign owner on issuance (#217).

The last measure queries legacy `users` within a Firestore transaction, but **two concurrent first-time issuances for different user docs with the same derived code can both observe no existing owner**. A query/read-before-write is not a durable, independent uniqueness record. Firestore alone does not impose a unique constraint on `users.referralCode`. This is a *possible race/collision*, **not** evidence of actual customer collisions.

Current latest exact-head automated evidence: [GitHub Actions #41118780445](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/41118780445), validate job `124279802948`, **completed/success**. Raw job log: `tests/launchEndpoint.spec.ts (34 tests)`, `tests/memberReferralClaimConcurrencyEmulator.spec.ts (3 tests)`, and `199 passed (199)` test files. These checks do **not** prove global uniqueness, legacy migration or a production deployment.

## Target invariants (security/Product/DPO approval required)

1. **One code, one current owner:** for any active code at most one eligible account can own the authoritative reservation. A different UID must fail explicitly without a side effect; even a concurrent first issuance must not produce two success responses.
2. **One owner, stable link:** repeat issuance is idempotent; no silent token rotation, user record rewrite or older-client breakage. Existing unqualified attribution must never imply verified/qualified/rewarded state.
3. **Client cannot mutate authority:** Firebase client rules deny direct create/read/write/delete for a dedicated registry; all writes and checks are via authenticated server and verified UID. No client-provided UID or provider-string authority.
4. **Deletion/consent is fail closed:** account deletion tombstones block issuance and claim *before* registry transition; registry is included in the idempotent Art. 17 cascade, export/discovery and audit evidence. Do not retain raw UID indefinitely for a supposedly expired account. Member consent, expiry and legal retention remain unapproved.
5. **Independent reward proof:** a code or registration event is never enough to set `isVerified`, `referralQualified`, entitlement or Klar+ time. Didit, age, consent, fraud limits and reversal are separate server-controlled transitions.

## Proposed schema — **not implemented**

A server-only collection `member_referral_code_registry/{code}` with a validated, ten-character code as the **document ID**, storing minimally `ownerUid`, `codeVersion`, `createdAt`, `updatedAt` and approved migration state. Its Firestore Security Rules are `allow read, write: if false`; Firebase Admin is solely responsible for transactional validation.

Avoid storing raw links, name/email, IP, ID document, device fingerprint or KYC result. If a keyed pseudonym is selected instead of `ownerUid`, the DPO must approve stable key rotation and provable deletion lookup first. Do not enable automatic TTL deletion for active reservations without a renewed ownership/expiry contract: silent expiration could allow code reassignment while old links remain circulating.

### Proposed issuance transaction

- Before the transaction: verify Admin-decoded token, current UID and nonanonymous provider; require accepted account state. Compute the existing deterministic code using the pinned secret version; never derive it from request body.
- **Read before every write:** read `users/{uid}`, `account_deletions/{uid}`, `member_referral_code_registry/{code}` and a bounded legacy `users.where('referralCode','==',code).limit(2)`; fail closed on unavailable, malformed or ambiguous results.
- Registry exists for **same owner**, correct active revision: idempotent; verify current user record and deletion/consent policy. Registry points to another UID or is invalid: generic conflict, no writes.
- Registry absent, no conflicting legacy owner: `tx.create(registryRef, validated minimal record)` and update the user's `referralCode` **in the same Firestore transaction**. Two distinct issuers targeting identical code must compete on **the same registry document**, so only one may commit; reattempts must observe the owner and reject the loser.
- Test/handle Firestore `ALREADY_EXISTS`, `ABORTED`, deadline and transient availability with controlled retry budget and no false `200` acknowledgements. Never fall back to an independent nontransactional write.
- Ensure the registry write, user update and associated audit event are consistent; idempotent retries must not create duplicate rewards or logs.

### Claim transition / legacy compatibility

- During **shadow migration**, preserve old ten-character links. Continue the proven bounded legacy lookup; if a registry exists it **must match** the unique legacy owner and current user/deletion markers, otherwise reject. If no registry exists, legacy unqualified `attributed` flow may continue only under the formally approved compatibility window, with no rewards.
- **Do not enable registry-only enforcement until** an inventory (aggregate counts, no code/UID export) shows all active legacy owners reconciled, collisions quarantined, abandoned codes classified, and a rollback gate signed off.
- During **enforce** mode, resolve owner from the registry, then recheck its user record, current `referralCode`, deletion tombstone and auth conditions inside the claim transaction. No trust in a bare registry owner string or client-supplied code without the owner recheck.
- If code derivation or provider rotation changes, version the code purpose and bounded overlap policy; never silently rotate `REFERRAL_CODE_SECRET` or invalidate existing links in this change.

## Art. 17 and retention integration

- Update `scripts/loeschkaskade.mjs` collection classification and `src/server/trustAndSafety.ts:purgeAccountData` to remove registry entries by `ownerUid` in bounded/resumable batches **before final account deletion acknowledgement**. Stage and test a lease/interrupted-page scenario.
- During deletion, tombstone must remain authoritative: prevent concurrent issuance and claims by checking `account_deletions` at transaction time. A deleted owner whose reservation remains temporarily must block reuse of that code until safe reconciliation.
- Include the new records in account export/discovery and evidence registers where applicable; define purge/audit retention with DPO and Legal. Do not place personal identifiers in operational traces or PR comments. Any required legal hold must be explicit, bounded and independently reviewed.
- Firestore Rules / IAM separation must be verified with emulator and staging. No direct Registry Client SDK access.

## Required test matrix and migration acceptance

| Case | Required result |
| --- | --- |
| Two new UIDs derive same code concurrently | One issuance succeeds, one generic conflict; exactly one registry doc and one owner |
| Same UID repeats after success / transient retry | Stable code and share URL; no duplicate events or rewards |
| Two old `users` records share one code | Both claim and issuance fail closed; aggregate collision evidence, no silent reassignment |
| Registry owner differs from user record or is malformed | Fail closed; no write or reward |
| Owner deleted, deletion pending or UID/provider invalid | Deny; no tombstone resurrection |
| Crash/timeout after transaction result unknown | Safe retry returns only committed owner state, never fabricated success |
| Art. 17 interrupted and resumed, including >1 page | No orphan owner references after completion; no other account touched |
| Rotated secret / expired or revoked link | Explicit product-approved version/overlap rule, never silent rebind |
| Legacy clients during shadow/enforce/rollback | Measured, reversible behavior with support/incident procedure |
| DPO/Security/SRE/Product/release sign-off | Recorded in immutable evidence; default NO-GO until all approved |

Emulator tests must use project `demo-klar`, expected local host/port and strict nonproduction guard. Add failure injection for interrupted transactions, deleted accounts and contention with actual Firestore transactions. E2E must use **real Firebase Admin-verified test tokens** in authorized staging, not synthetic `req.user` injection. Prometheus/budget and canary/rollback evidence are separate mandatory release gates.

## Rollout decision points (none authorized yet)

1. **Discovery and explicit DPO/Product decision:** inventory unique/colliding legacy codes as aggregate counts only; determine retention and communication plan, index/IAM constraints and security economics. Do not browse or export real user data without the responsible authorization.
2. **Schema + rules + Art.17 tests:** isolated feature PR with the registry disabled until all necessary deletion and migration tests pass. Security review of multi-user race and regex constraints.
3. **Shadow-mode staging migration:** transactionally backfill valid unique codes with resumable checkpoints and deterministic no-rewrite behavior; quarantine colliding or unknown code owners. Prove cleanup and rollback without production writes.
4. **Enforced issuance, compatible claim, monitored pilot:** use immutable image digest, measured metrics, canary window and real Firebase user credentials; produce actual evidence and approval.
5. **Controlled production cutover** only after independent Security, DPO/Legal, Product, SRE and Release Owner acceptance. Rollback must **not** reinstate unsafe unreserved issuance; on uncertainty temporarily suspend *new* code issuance rather than permitting ambiguous ownership.

**No migration, registry collection, IAM/Scheduler change or deployment has been executed by this ADR. The original project and P0 issues #48/#55/#56/#70/#202/#8 remain BLOCKED / NO-GO.** PR #119 and RC R2 remain immutable.
