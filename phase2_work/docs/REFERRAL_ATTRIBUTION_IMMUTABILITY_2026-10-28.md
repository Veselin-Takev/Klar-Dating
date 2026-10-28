# P0 #48 — Immutable member referral attribution (2026-10-28)

Status: **Draft / NO-GO**. Parent: issue #48; separate from B2B partner referrals.

## Root cause and change

The existing `POST /api/referral/claim` handler acknowledged any valid inviter code after detecting `referredBy`, even when the already-persisted inviter UID was different. Although this did not reassign the relationship, a caller could receive a misleading `ok: true` response. The transactional guard now returns success **only** if the persisted inviter UID equals the currently resolved inviter UID. A conflicting attribution fails closed with the existing 409 response and does not write referral events or reward state. No schema/API success-body change and no new reward mechanisms.

## Regression coverage

`tests/launchEndpoint.spec.ts` now includes: (1) a competing inviter code against an existing attribution must return 409 and perform zero writes; (2) an identical inviter retry returns 200, still zero writes. Existing generation, first-claim, repeat-claim, account-deletion race and non-KYC behavior tests remain applicable. CI must execute this test on the exact PR SHA; no PASS is claimed until observed. Test commands from `phase2_work`: `bun run typecheck`, `bun run vitest run tests/launchEndpoint.spec.ts`, `bun run check:enterprise`. No local or cloud tests were performed at authoring time.

## Residual security work / rollout

Issue #48 remains open: signed Didit KYC authority, self-referral/sybil defenses, token lifecycle, replay and concurrency under real Firestore emulator, HMAC rotation, capped fixed-duration Klar+ rewards, reversal on fraud, Art. 17 deletion, legal/consent sign-off and E2E are not established by this patch. Deployment and live reward issuance are not authorized. Roll back via revert of this isolated commit if needed. Base SHA: `2808dc1cbb485f70b403681c108cea5a3361d950`. **Production NO-GO.**

## CI failure triage — 2026-10-28

The first exact-SHA Enterprise CI failed in `tests/launchEndpoint.spec.ts` because new negative tests counted **all** `fixture.writes` (including expected pre-handler distributed rate-limit writes) as forbidden business writes. The request limiter runs before the referral transaction. The corrected assertions constrain the invariant to `users/` and `referral_events/`, ensuring that invalid / duplicate requests never mutate referral attribution while permitting legitimate limiter accounting. The test still asserts HTTP status and unchanged business state. Initial failing CI run: 40690457236 (2 failures). A new exact-HEAD CI run is required; prior failures remain part of the audit trail. No local test execution or production approval is claimed.
