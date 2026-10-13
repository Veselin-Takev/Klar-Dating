# Birthdate persistence/hydration audit — 2026-10-13

## Verified source behavior
The server's `processAgeVerification` already writes `geburtsdatum` (ISO date) and `isAdult: true` together in a Firestore transaction under `users/{uid}`, plus audit evidence. The original client schema exposed `birthdate` but not the actual `geburtsdatum` field; although its passthrough mode preserved the runtime value, typed application code could not safely verify the persisted date. The age form previously allowed proceeding if `refreshProfile()` returned an empty/null profile, and checked only the adult flag otherwise.

## Changes
- Add nullable optional `geburtsdatum` to `UserProfileDataSchema` so Firebase server snapshots hydrate this exact canonical field into typed global profile state. Keep the legacy `birthdate` field for backward compatibility; do not duplicate or infer private DOB into a new document field.
- After successful `/api/account/alter`, require `refreshProfile()` to return both `isAdult: true` and an exactly matching `geburtsdatum`; on disagreement remain on age gate and show an error.
- Tests cover adult and locked-underage date hydration, and the explicit server readback requirement.

## Privacy and security
Birthdate is sensitive personal data. No localStorage, sessionStorage, logs, public profile or telemetry copy has been added. Actual persistence remains server-owned and transactional. The app must never rely on the birthdate field alone for privilege elevation; server authorization continues to use verified adult status.

## Important limits
The schema was previously `passthrough()`, so the mismatch does **not** prove that Firestore had failed to persist the date in production. A repeated age gate may additionally arise from missing `isAdult`, profile fetch errors, Firestore rules, account reset or consent version mismatch; diagnose with redacted emulator/browser evidence before asserting root cause. Existing users missing a DOB require authorized migration/reverification, not a fabricated date.

Exact-head `npm run typecheck`, `npm run test:pure`, `npm run test:rules`, `npx playwright test`, `npm run build`, real-account lifecycle/browser and Firestore emulator tests are not independently confirmed here. No production-ready project ZIP generated. Release remains NO-GO pending GitHub Issue #8 operational signoffs. No manual Actions rerun dispatched.
