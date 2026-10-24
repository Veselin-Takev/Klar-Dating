# ADR: Reserved partner attribution parameter rejection — 2026-10-18

**Decision:** Draft security fix, **NO-GO**.

## Problem
The validated partner campaign `destinationUrl` previously permitted an existing `klar_referral` query key. In `recordPartnerClick`, a non-consenting visitor takes the **direct** redirect path. Without rejecting preconfigured query keys, that direct redirect could still carry a token set by a campaign editor or imported legacy record. Consent-based token attachment in `trackedDestination` cannot repair the untracked branch.

## Change
`validatePartnerDestinationUrl` now rejects the reserved `klar_referral` key using decoded URLSearchParams and case-insensitive comparison. This is performed both during campaign creation/update and when resolving existing destinations. It permits ordinary non-reserved campaign query parameters. No redirect path, campaign schema, or tracking opt-in is weakened. Tests cover ordinary URLs, preseeded key, uppercase key, percent encoding and mixed query strings.

## Boundary and remaining risks
A partner could receive data from other campaign query parameters; legal/Privacy review still must approve destinations, data sharing and tracking. Browser history, downstream partner retention, existing issued stable referral tokens, consent records, and account deletion behavior require separate verification. This patch does not provide independently verified purchase proof (#55) or close #56.

## Rollout and compatibility
Existing campaign URLs containing `klar_referral` will now fail closed until an authorized operator removes that key; inventory affected campaigns before rollout and avoid copying tokens into logs, diagnostics or issue comments. Review this deliberate behavior change with owners; no automatic migration or destructive update. Rollback by reverting validation and tests **only after security review**, since rollback re-opens the token leak. Verify with `npx vitest run tests/partnerReferralCore.spec.ts`, then the complete pinned-node, Firebase Emulator, E2E, npm audit, and build gates. No production, staging, or GitHub Actions activity was initiated.
