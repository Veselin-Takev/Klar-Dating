# P0 #48 — Adult-eligibility guard for member invitations (2026-10-28)

**Draft / PRODUCTION NO-GO.** Parent PR #172, head baseline `8b12945a3fe717316c69c1e33b107afbaad07bdb`; stacked because both modify the same referral endpoint and regression fixture.

The existing `GET /api/referral` flow verified account existence and absence of a deletion request, but did not check `isAdult`. The `POST /api/referral/claim` transaction also did not require `isAdult` for either the invitee or inviter. This change requires explicitly persisted `isAdult === true` from both participants at the transactional decision point (for generation, inviter only), rejecting missing or false values before any writes. Requests return the existing 409 body, with no token disclosure or modified public schema. The check does not grant KYC status or reward credit.

Targeted HTTP regression cases: missing or false adult eligibility blocks link generation, and false adult eligibility on either side blocks claim, asserting zero writes. Existing tests now model an eligible adult inviter. CI must independently test this exact source SHA (typecheck, `vitest run tests/launchEndpoint.spec.ts`, static policy gates); no green run is claimed at authoring.

**Limitations:** a client-writable or untrusted `isAdult` is insufficient for genuine age assurance. Confirm that this field is server-authoritative and supported by the approved onboarding/KYC age policy; signed Didit `isVerified` remains a separate prerequisite for any future reward payout. Still required: idempotent fraud-resistant rewards, concurrency and emulator E2E, consent/Art17, threat model, Security/DPO/Legal reviews, and rollout evidence. Rollback is a revert of this isolated branch; never bypass mandatory security gates. Production remains **NO-GO**.

## CI failure triage — 2026-10-28

First exact-SHA Enterprise CI run `40690770437` failed six new HTTP tests: the test fixture records legitimate distributed rate-limit counter writes before the referral transaction, so `fixture.writes.length === 0` is not the correct invariant. Four direct assertions were corrected here; both inherited #172 assertions are fixed in parent PR #172 commit `5b065a366e0e32c78708e29077d69fa300efe882`. This branch still contains a snapshot of those two inherited unfixed assertions and must be synchronized with the parent before final approval. For this branch, assertions now restrict the no-business-write invariant to `users/` and `referral_events/`. Prior failures stay in audit history; fresh exact-HEAD CI required. Production NO-GO.
