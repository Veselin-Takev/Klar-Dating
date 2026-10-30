# P0 #48 — Member Referral Attribution Conflict Guard (2026-10-30)

**Decision: Draft implementation, release BLOCKED / NO-GO.** This change is stacked on the separately validated anonymous-Firebase-account gate in Draft PR #214; it does not merge or deploy either change.

## Verified source defect and intended invariant
`src/server/routes/launch.ts` currently resolves an inviter's 10-character code and rechecks the inviter, current member and both deletion markers in a Firestore transaction. If `users/{invitee}.referredBy` is already truthy, the transaction previously returned `true` **without checking that the recorded inviter equals the inviter identified by the supplied code**. The HTTP response `{ok:true}` could incorrectly acknowledge a conflicting code despite not changing the actual attribution. This is not proof of awarded Klar+ time or KYC bypass, but is a misleading business contract and risky foundation for a future reward lifecycle.

## Minimal corrective behavior
- For an **existing matching inviter**: preserve idempotent `200 {ok:true}`; no second event, no requalification, no reward.
- For an **existing different inviter**: return the pre-existing generic `409` referral-unavailable response; **no Firestore write** and no disclosure of the existing inviter.
- For a **first valid attribution**: continue the existing transaction, write `referredBy`, `referralQualified:false` and one `status:'attributed'` event. This patch does not grant verified status, qualification, premium time or referral credit.
- Continue to reject anonymous Firebase provider sessions under Draft #214; do not change or conflate B2B `/partner/*` conversion contracts, consent or paid rewards.

## Test and CI evidence
`tests/launchEndpoint.spec.ts` now has matrix cases for `referredBy='other-inviter'` -> 409/no writes and `referredBy='inviter'` -> 200/no writes, both preserving `referralQualified:false`. Existing tests cover first attribution, idempotent repeated claim, missing/deleting account, malformed token and the guest guard.

**New code and tests have no exact-head CI PASS yet.** Require actual execution and green TypeScript, Vitest, Firebase emulator and browser acceptance on this feature commit, with no skipped target tests. Previous [PR #214 GitHub CI #41110293217](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/41110293217) **completed/success** and raw job log includes `tests/launchEndpoint.spec.ts (23 tests)`, overall `198 passed (198)` files. This evidence applies to the parent commit `59f0231e1eed83d543b7070c98622b309eb3acd8`, **not** to the new conflict guard.

## Compatibility and residual risk
Changing a previously reported HTTP 200 on a conflicting already-attributed member to HTTP 409 is a deliberate semantic correction. Confirm UI behavior and support messaging against existing clients in approved staging before integration. Member referral `registered → verified → qualified → rewarded` is not implemented; Didit-only authority, anti-Sybil rules, consent, KYC, TTL, refund and bounded Klar+ time rewards require independent Product, Security, DPO/Legal and SRE acceptance. A missing Firebase provider claim is not independently proven a permanent account by this change; review the auth middleware and migration policy separately.

**NO-GO / NOT PRODUCTION VERIFIED.** No live credentials, data, provider callbacks, ad-hoc Actions dispatch, main commit, merge or deployment. PR #119 and RC R2 remain frozen.
