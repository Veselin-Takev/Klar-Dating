# P0 #48 — Staged atomic member-referral ownership primitive (2026-10-30)

**State: IMPLEMENTED AS UNCONNECTED CODE; NOT MIGRATED, NOT ACTIVE, NOT APPROVED.**
**Release decision: PRODUCTION BLOCKED / NO-GO.**

## Change scope and ancestry
This isolated branch follows the proposed [atomic ownership ADR](ADR_MEMBER_REFERRAL_ATOMIC_CODE_OWNERSHIP_2026-10-30.md) and the existing Draft chain through [#218](https://github.com/Veselin-Takev/Klar-Dating/pull/218). Existing `GET /api/referral` and `POST /api/referral/claim` continue to use their legacy code paths. A static regression test asserts that the new registry is **not connected** to either route; nothing here activates a migration, a reward, a Firebase task or a database write in production.

## Implemented files
- `src/server/memberReferralCodeRegistry.ts`: isolated `reserveMemberReferralCode(db, uid, code)` helper. Accepts only validated document IDs. It reads `users/{uid}`, `account_deletions/{uid}` and `member_referral_code_registry/{code}`, then checks up to two legacy owners **before any writes**. A missing owner or deletion tombstone denies. A foreign legacy owner, invalid/revoked reservation or mismatched old code denies. The same owner/code returns idempotent `already_owned`. A new valid owner creates the registry record and updates the user profile inside **one Firestore transaction**.
- `firestore.rules`: explicit client `allow read, write: if false` on `member_referral_code_registry/{code}`. Only a trusted Admin SDK implementation could use the registry; this module does not accept a client UID in a route.
- `src/server/trustAndSafety.ts`: Art.-17 account purge now scans `member_referral_code_registry.where('ownerUid','==',uid)` using the existing bounded/deletion-slice loop. Deletion is guarded by the existing `account_deletions` tombstone. The personal owner UID must not be kept after the account purge.
- `scripts/loeschkaskade.mjs`: privacy inventory explicitly classifies the registry as `geloescht`, preventing undocumented personal collection retention.
- `tests/memberReferralCodeRegistryEmulator.spec.ts`: five scenarios against actual local Firestore emulator, not mocked Firestore: concurrent two-UID first issuance for a code with one winner; same-owner retry and loser conflict; legacy duplicate owners; unique legacy record plus revoked reservation; pending deletion or missing account; bad UID/code rejected before DB access.
- `tests/rules.spec.ts`: emulator Security Rules test denies signed-in and unauthenticated reads, plus creation, update and deletion by clients.
- `tests/memberReferralRegistryReleaseBoundary.spec.ts`: source-contract guard that the registry is not wired to either live route; the rules/privacy cascade/inventory remain present.

## Security contract
Firestore has no unique index for `users.referralCode`; the proposed authoritative registry uses one **shared document ID per code**. In a competing first-issuance transaction, both callers may initially see no registry, but only one can commit its create, and retries must observe the resulting owner. This resolves the future registry race **for calls to the helper**, not for the still-active legacy endpoints. It provides no KYC/consent/age or reward authority.

Result codes `created`, `already_owned`, `conflict` and `account_unavailable` are server-internal; no HTTP contract or customer-visible message is changed. The helper does not catch unknown Firestore errors and must never return success after a failed transaction. It does not rotate secrets, write legacy records in bulk or award Klar+ durations.

## Evidence and release acceptance
**At authorship, the new head's CI and emulator execution are NOT YET VERIFIED.** The ancestor [CI #41118780445](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/41118780445) succeeded at PR #218 with 34 launch HTTP tests, 3 real emulator tests and 199/199 test files. That PASS **does not** certify this new helper.

Accept only after exact-head CI and raw logs confirm all five new emulator cases (not skipped), the Rules negative test, TypeScript, enterprise Security/Art.-17 boundary gates, build and browser acceptance. Failed/aborted/timeout scenarios and interrupted Art.-17 cleanup still require additional dedicated integration evidence. Never infer a successful live cloud policy from unit/emulator output.

## Missing approval, migration and rollout
1. Product, Security, DPO/Legal, Operations/SRE and Release Owner approve legacy-code conflict handling, storage retention and member terms. Do not inspect/export customer invitation codes or UIDs without proper access approval.
2. Introduce a versioned, resumable and *transactional* unique-only legacy backfill with collision quarantine and aggregate-only reconciliation; prove interrupted/resumed execution and rollback.
3. Update member-claim route to check registry ownership **in its own transaction**; otherwise a registry record alone does not prevent legacy claims. Define a controlled shadow/enforce/rollback state machine and operational metrics.
4. Integrate the helper into issuance only behind the approved rollout gate, preserving existing links; ensure account deletion tombstones and corresponding owner reservation cannot be resurrected on retries.
5. Verify real Firebase-Admin-decoded tokens, adult/consent/Didit authority, client rules, Art.-17 cleanup, costs, performance and fraud/reward reversal in approved staging. Promote only with documented independent approvals.

**Hard governance:** no merges, direct `main` commits, manual GitHub Actions dispatch, production reads/writes, IAM/policy mutation, automatic secret rotation or deployment; frozen PR #119/RC R2 untouched. P0 #48 and #8 plus #55/#56/#70/#202 remain unresolved. **PRODUCTION NO-GO.**
