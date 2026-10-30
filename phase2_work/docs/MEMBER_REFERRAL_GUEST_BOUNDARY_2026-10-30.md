# P0 #48 – Member Referral Permanent-Account Gate (2026-10-30)

**Status: Draft / source candidate, CI not yet independently verified; PRODUCTION BLOCKED / NO-GO.**

## Motivation and scope
`src/server/routes/launch.ts` protects `GET /referral` and `POST /referral/claim` with authentication/UID-based distributed limits, but an **anonymous Firebase session can also have a UID**. Unlike B2B partner referral routes, the member invitation endpoints did not explicitly reject the Firebase `sign_in_provider: anonymous` claim. This allows issuing an invitation code to a session that is not a registered permanent account, and a guest invitee can attempt to claim. This is an **unauthorized eligibility surface**, not evidence of rewards: existing code writes only `referralQualified: false` and `status: attributed`, with no Klar+ reward.

## Change
- `src/server/routes/launch.ts`: add early explicit `requirePermanentReferralAccount` middleware, **before** the distributed limiter, code generation, or Firestore lookup for both member referral routes. Explicit Firebase anonymous provider -> HTTP 403. No impact on basic app use, launch summary, activation or the separate B2B `/partner/*` routes.
- `tests/launchEndpoint.spec.ts`: HTTP negative test injects a verified-form Firebase request context with a UID plus `firebase.sign_in_provider = anonymous`, verifies both endpoints deny with 403, **zero collection calls and zero transactions**. A permanent password-provider path still claims and produces `referralQualified: false` without changing `isVerified`. Existing tests cover missing/deleting profiles and repeated claims.
- The guard trusts the existing server authentication middleware to populate `req.user`; it does not accept a client-submitted claim. The absence of `req.user.firebase.sign_in_provider` is **not** treated as a verified permanent-account proof: this minimal compatibility patch denies only explicitly documented anonymous sessions. A separate risk review must establish whether legacy auth contexts without provider claims require a stricter fail-closed policy, with migration and tests.

## Risk and acceptance
- [ ] Exact-head CI shows new HTTP tests run and pass (not skipped), alongside typecheck/enterprise gates/browser acceptance.
- [ ] Staging: real Firebase guest token denied; permanent email/OAuth accounts allowed; revoked/deleted account denied. Capture auth middleware identity mapping without logging ID tokens.
- [ ] Independent product/legal approval of member referral eligibility, user consent, guest-upgrade behavior, limits and retention.
- [ ] The unimplemented lifecycle `issued → visited → registered → verified → qualified → rewarded`, dedupe/fraud, Didit-only verification, reward duration, reversal and Art.17 remain blocked under #48/#47/#8.
- [ ] Provider-claim authenticity and independent purchase proofs under #55/#56 are **different** B2B controls and are not changed here.

**Change control:** New isolated Draft PR stacked on current documentation branch; no direct main commits, no deployment, no live data access, no manual workflow dispatch. PR #119 and RC R2 remain frozen. **PRODUCTION NO-GO.**

## Exact-head CI evidence register
- Draft [PR #214](https://github.com/Veselin-Takev/Klar-Dating/pull/214) initial HEAD `f02873aed2771dfff8fa04c0e1e14dd7b8308731`: [GitHub Actions #41110010141](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/41110010141) **FAIL**, validate job `124249683010`. Raw log identifies `TS2322` at `tests/launchEndpoint.spec.ts:89`: incomplete test-only Firebase `req.user.firebase` identity fixture typed incompatibly with the existing Request type. No product-code regression or complete test PASS was claimed.
- Candidate fix HEAD `59f0231e1eed83d543b7070c98622b309eb3acd8`: test fixture now uses `Object.assign(req, { user: { firebase: { identities: {}, sign_in_provider: firebaseProvider } } })`. Security route guard is unchanged. Follow-up [GitHub Actions #41110293217](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/41110293217) was **in_progress** during initial audit. Only exact-head success with the guest tests actually executed can verify the correction.
- This evidence-only update is on a separate documentation branch and is not merged into the Draft PR head; avoid triggering extra full Actions runs for prose alone. The issue remains P0, staged auth mapping and release signoffs unverified. **PRODUCTION BLOCKED / NO-GO**.

## Resolved exact-head verification (2026-10-30)
- Draft PR [#214](https://github.com/Veselin-Takev/Klar-Dating/pull/214) HEAD `59f0231e1eed83d543b7070c98622b309eb3acd8`: [Actions #41110293217](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/41110293217) **completed/success**, validate job `124250654157` succeeded without failed steps. Raw log confirms `tests/launchEndpoint.spec.ts (23 tests)` PASS and `198 passed (198)` total test files, under demo Firebase emulators. Previous TS2322 from the incomplete test fixture is fixed on this head.
- The narrower provider-claim guard does **not** itself prove current staging JWT mapping or full member referral/KYC/reward lifecycle. **No production GO.**
- Separately, [Draft PR #215](https://github.com/Veselin-Takev/Klar-Dating/pull/215) extends this branch with a related **different-inviter attribution conflict** fix and HTTP negative tests. Its exact-head CI must be reviewed independently; do not transfer #214's PASS. See `docs/MEMBER_REFERRAL_ATTRIBUTION_CONFLICT_2026-10-30.md` in #215.
