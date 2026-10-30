# Member referral code issuance collision check — P0 #48

**Date:** 2026-10-30. **Status:** isolated Draft; source only until exact-head CI. **PRODUCTION BLOCKED / NO-GO.**

## Source-grounded finding
The existing `GET /api/referral` transaction checked that the current member existed and had no pending account deletion, then always wrote a deterministic, truncated, ten-character HMAC-derived `referralCode` and returned a share URL. If another user's account already carried the same code, issuance would return an **unusable/ambiguous** link. The earlier [Draft PR #216](https://github.com/Veselin-Takev/Klar-Dating/pull/216) correctly blocks ambiguous **claims** but does not block generating another such link. There is no claim or evidence that actual accounts collided.

## Targeted change / compatibility
- Inside the already-existing Firestore issuance transaction, after user and account-deletion checks and **before** any user update, read at most two current users with that code: `tx.get(db.collection('users').where('referralCode','==',code).limit(2))`. Deny issuance if **any owner other than the caller** is returned. Use the pre-existing generic HTTP 409 message, disclose no account IDs, and issue no misleading share URL.
- Empty result permits first issuance. A unique matching account permits repeat issuance with the existing response `{code,shareUrl}`.
- Keep the anonymous Firebase gate (#214), current-claim attribution conflict rule (#215) and ambiguous claim lookup (#216). No changes to code derivation, user data schema, consent, KYC authority, reward accounting or B2B partner referrals.

## Regression evidence to verify at exact head
- HTTP `tests/launchEndpoint.spec.ts`: existing foreign code owner -> HTTP 409 and **zero writes**; same user's existing code -> HTTP 200 with original share URL. Existing fake Firestore transaction now supports a bounded query read for this test, while prior claim and deletion cases remain.
- Real local `demo-klar` Firestore emulator `tests/memberReferralClaimConcurrencyEmulator.spec.ts`: seeded foreign code owner blocks `GET /api/referral`; the caller has no `referralCode` afterward; prior owner stays unchanged. The earlier different-owner claim race and duplicate-owner claim tests remain. Expect **three emulator tests**, **29 launch endpoint tests**, total **199 test files**, subject to exact-head CI.
- This change is **not yet test-verified** until current HEAD is checked by typecheck, mandatory static gates, test:ci with emulator (not skipped), build, browser acceptance and CI provenance.

## Residual invariant gap — NOT a uniqueness reservation
**The query-based preflight cannot guarantee global uniqueness:** two simultaneous transactions against separate user documents can each observe no conflicting code before both write. A later server write/backfill could also insert a duplicate code. Before awarding paid or time-based benefits, require an authoritative, atomic code reservation document keyed by the code, migration of legacy codes, claim-time registry verification and abuse/replay controls. Design migration, expiry/rotation, collision remediation and rollback with Security/Product/DPO; do not introduce it ad hoc into the current user-based lookup path.

Do not export/link any real user IDs, codes or secret values into diagnostics. Only authorized, aggregate staging counts are permissible.

## Governance
Draft feature branch stacked on #216, not a merge or production deployment. The tested #216 head `3f945950ecff5b8c077997315b7b54de941de24f` passed [CI #41116247314](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/41116247314): real emulator (2 tests), launch HTTP (27 tests), and 199 test files. **That PASS does not transfer to this change.**

P0 #48 and #8 remain open. Also P0 #55/#56 partner proofs, #70 active TTL and #202 deployed photo-retention evidence remain unresolved. Require authorized staging verification, 2-person Security/Privacy/Product/SRE/Release Owner signoffs. No direct main changes, merges, manual workflow restarts or production access. Frozen PR #119 and RC R2 untouched. **NO-GO.**

## Exact-head CI evidence – 2026-10-30
- [Draft PR #217](https://github.com/Veselin-Takev/Klar-Dating/pull/217), exact source HEAD `2172b8f6f9a1c439719539957bcb1dd6c0f44627`: [GitHub Actions #41117581493](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/41117581493) **completed/success**, validate job `124275690279` **completed/success** with zero failed steps.
- The **original CI job log** confirms `tests/launchEndpoint.spec.ts (29 tests)` and `tests/memberReferralClaimConcurrencyEmulator.spec.ts (3 tests)` both executed and passed, `199 passed (199)` total test files. This confirms both the foreign-owner issuance denial and same-user code compatibility; the emulator case ran, not skipped.
- This is local test evidence only. A bounded query does **not** provide global atomic uniqueness, nor prove Firebase stage JWTs, Didit KYC, GDPR erasure, production token rotation, reserved-code migration, or independent release approval. **Production remains BLOCKED / NO-GO.**
- The evidence-only documentation update is intentionally on a separate isolated branch with no PR to avoid an additional full CI run. It does not change the exact tested #217 head.
