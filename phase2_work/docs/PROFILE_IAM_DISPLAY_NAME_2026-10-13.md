# Profile IAM display name synchronization — 2026-10-13

## Identified defects
- AuthContext generated missing Firestore user records with literal `name: "Neu"`, which became a persistent placeholder.
- Profile.tsx displayed stored `profileData.name` without reconciling the Firebase Auth identity's `displayName` or verified email.

## Implemented
- New profiles no longer persist the literal placeholder `Neu`.
- `resolveProfileDisplayName` prioritizes an explicit Firestore profile name, then Firebase Auth `displayName`, then a verified email prefix for display only; unverified addresses are never used as fallback. Existing legacy `Neu` values are treated as absent for display.
- Profile header reads the authenticated user exposed by `useAuth` and applies this UI-only resolution. Derived email fragments are **not** written into the Firestore user profile or published to other members.
- Existing `updateProfileData` remains the Firestore-backed authoritative update path; no client-side authorization claims, new Firestore rule exemptions or speculative schema migration were introduced.

## Evidence and remaining release work
- Added pure regression tests for name precedence, legacy values and unverified-email privacy.
- **Not verified:** actual email-verification refresh timing; cross-device profile state and concurrent name edits; full `npm run typecheck`, `npm run test:pure`, `npm run test:rules`, `npx playwright test`, `npm run build`; Firestore emulator/browser integration and release build. An account with a blank name still needs an explicit name editor (if not already offered elsewhere) to persist a user-chosen name.
- Exact-head CI and production approvals are pending. Production **NO-GO**, and no complete ZIP has been produced from a checkout.

## 2026-10-13 — Name editing closure

Added a keyboard-accessible 'Namen bearbeiten' editor directly in the profile header. The form validates a nonempty trimmed label of at most 80 characters, submits a single awaited `updateProfileData({ name: value })` call, keeps input on failure and announces the confirmed result through a live status region. It does not write email-derived fallback names or change Auth custom claims. Added a structural regression guard; comprehensive Firebase emulator and browser tests remain pending. Exact-head CI of the final PR revision is required before merge. Production NO-GO.
