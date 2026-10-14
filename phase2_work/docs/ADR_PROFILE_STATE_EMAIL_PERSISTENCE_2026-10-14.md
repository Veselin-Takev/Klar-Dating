# ADR — authoritative profile hydration and email session persistence (2026-10-14)

Status: **Proposed / PR candidate**. Base: `main` `bee87aea09a8d10b2e2c3fb74e38e5ecb12be008`; NOT yet released.

## Context / Verified source findings
- `src/lib/AuthContext.tsx` previously inherited `isAdult:true` and previously granted `einwilligung` if a fresh server snapshot omitted those fields. A missing field must not silently elevate adult or consent authority.
- Google login sets `browserLocalPersistence`; guest login sets `browserSessionPersistence`; email sign-in and sign-up previously did not call `setPersistence`. Therefore their lifetime could inherit a previous guest-session policy. This is a source-level risk, not proof that registration failed in a deployed client.
- `src/screens/ProfileSettings.tsx` submitted `POST /api/profile/update` without an auth token and invoked `onSave` without checking `response.ok`, showing false success even on rejected writes. The existing `updateProfileData` path already uses Firebase write, waits for pending writes, and verifies an authoritative server readback.

## Decision
1. Treat missing server-provided `isAdult` and `einwilligung` fields as non-authoritative: remove inherited fallback from previously hydrated state. Preserve only what the validated current server snapshot explicitly authorizes. Offline cached/pending snapshots cannot authorize.
2. Before email sign-in and email registration call `setPersistence(auth, browserLocalPersistence)`; if setting persistence fails, do not proceed with authentication. Guest sign-in remains session scoped, Google remains local scoped. **[ANNAHME]** Klar's permanent email account UX intends continued login across browser restarts; Product/Privacy must approve and update the user notice if required.
3. Save interests through `updateProfileData({interests})` and call parent `onSave` only after verified persistence; otherwise show accessible error state and retain unsaved edits. Hydrate fresh props/account UID changes deterministically and avoid resetting drafts on equivalent props.
4. No changes to server RBAC, Firestore rules, birthdate authority, consent ledger, or profile-publication conditions. Never persist birthdate/consent in localStorage as auth truth.

## Regression coverage
- `tests/AuthContext.spec.tsx`: adult/consent revoked if omitted in a later server snapshot; `setPersistence` call precedes email sign-in/sign-up.
- `tests/ProfileSettingsPersistence.spec.tsx`: rejected server confirmation cannot trigger `onSave`; pending writes disable duplicate submission; successful readback triggers callback; new profile props reset stale drafts.
- Also require existing auth/age/onboarding/firestore-rules tests and an actual two-account sign-in/guest-upgrade/reload journey.

## Verification & rollback
Exact-head CI after all edits, plus mandatory gates: `node scripts/check-secrets.mjs`, `node scripts/check-auth-boundary.mjs`, `node scripts/check-public-firestore-rules.mjs`, `node scripts/check-ai-pii-sanitizer.mjs`, `node scripts/check-art17-deletion-audit.mjs 0`, `npm run typecheck`, `npm run test:pure`, `npm run test:rules`, `npx playwright test`, `npm run build`.

No claim of local full PASS until these commands really run on **Node v22.23.3** with dependencies and emulators. Rollback only via reviewed SHA after incident analysis; do not restore the privileged snapshot fallback.

Production **NO-GO / NOT CONFIRMED**, issue #8 approval mandatory.
