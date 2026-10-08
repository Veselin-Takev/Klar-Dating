# Klar v149 — Release Hardening Status (2026-10-07)

## Scope

This document records the deterministic v149 hardening pass against the v148 UI/UX decisions and the enterprise v146 security baseline.

## Completed

- Canonical six-area responsive AppShell retained: Entdecken, Gespräche, Coach, Rituale, Tipps, Profil.
- Manifest remains content under `Tipps -> Klar Prinzipien`; no seventh navigation route exists.
- Date-preparation checklist no longer uses `klar_checklist` in browser `localStorage`.
- Date-preparation state is UID-scoped in IndexedDB and synchronized through `/api/checklists/date_prep` to `users/{uid}/checklists/date_prep`.
- Example profiles are excluded server-side from recommendation and chat delivery.
- Node runtime policy is pinned to 22.23.3 across `.nvmrc`, CI, GitLab CI, Docker and release metadata.
- Root dependency policy is Bun 1.4.2; Functions use committed npm lockfile.
- v146 security/compliance boundaries restored and revalidated: Firebase Admin token verification, Firestore public-access boundary, UID-scoped storage, AI PII sanitizer, distributed rate limits, mail lease recovery, Art. 17 deletion audit and BGB §312k cancellation flow.
- Route inventory has zero unacknowledged endpoints; stale AI endpoint references were removed.

## Verified in this runner

PASS: dependency-lock policy, CI toolchain pins, runtime alignment, naming, labels, i18n catalog, secrets, auth boundary, public Firestore rules, UID storage boundary, AI PII sanitizer, distributed rate-limit controls, mail lease recovery, Art. 17 deletion audit, BGB cancellation flow, production-data gate, contrast, hooks, CSP and route inventory.

## Environment blockers

The runner currently provides Node.js 22.16.0 and no usable npm registry access. `nvm install 22.23.3` and `nvm ls-remote 22.23.3` cannot obtain the requested runtime. The requested `npm ci --ignore-scripts=false` was attempted and timed out; no `node_modules` tree was created.

Therefore the following are **BLOCKED**, not passed by inference:

- full TypeScript compilation
- Vitest unit/pure tests
- Firestore emulator rules tests
- Playwright critical E2E tests
- production Vite/server build and bundle budget
- release identity/SBOM generation requiring protected CI identity, release tag and immutable image digest
- OCI attestation verification without a published registry index
- staging smoke test without isolated Firebase emulators/deployment
- production promotion without protected project/credentials/approval

## Release gate

**PRODUCTION: NOT APPROVED / BLOCKED (Non-Prod).**

`PRODUCTION_READINESS.md` must remain blocked until the protected CI/release environment produces the required evidence. No `v1.49.0` production tag or promotion is created in this local runner.

## Auth lifecycle + glossary hardening — 7 October 2026

- Added authenticated `POST /api/auth/logout` behind the existing `/api` authentication boundary. The endpoint revokes all Firebase refresh tokens for the authenticated UID, deletes the UID-scoped push-token documents under `users/{uid}/fcmTokens`, clears `__session`, and returns `{ success: true, timestamp }`.
- Added `tests/authEndpoint.spec.ts` covering unauthenticated `401` and successful `200`, including refresh-token revocation, push-token cleanup and cookie clearing.
- Extended `AuthContext.logOut()` with a fail-safe server logout call through the existing `authFetch` boundary, UID-scoped offline cleanup, API/KI in-memory cache reset, Firebase sign-out, local storage cleanup and deterministic `/login` navigation.
- Added a confirmation dialog and accessible red secondary `Abmelden` action to `ProfileSettings.tsx`; the active Profile settings screen now uses the same confirmation pattern.
- No invitation coins or other gamification currency were introduced. Existing invitation/Founding-Member rewards remain expressed as explicit Klar+ time periods.
- The exact legacy invitation strings named in the v149 task brief are not present in this source snapshot, so no unused translation/UI copy was fabricated. Any future occurrence must use `Verbindungs-Tipps` and `Prioritäts-Vorschläge`.
- Glossary-visible copy in the affected settings/recommendation UI was normalized away from the prohibited product terms while stable internal identifiers remain unchanged for compatibility.

## Full lifecycle verification — 7 October 2026

- Phase 1: no temporary, log, pre-merge dump or backup artifacts were found in the product tree. The supplied v149 source artifact contains no `.git` metadata, so upstream Git working-tree cleanliness cannot be attested from this archive.
- TypeScript configuration files are synchronized with the v149 baseline: `tsconfig.tests.json` extends the root configuration and server/root compiler safety flags remain aligned.
- Phase 2: all requested static, naming, localization, security-boundary, distributed-rate-limit, lease-recovery and Art. 17 gates pass after the deletion-rate-limit cleanup fix.
- The Art. 17 deletion catalog now explicitly removes `account_deletion_rate_limits`, including its UID-derived document, so the deletion catalog reports zero undecided collections.
- Phase 3/4 execution remains blocked in this archive runner because runtime dependencies (`vite`, `vitest`, package type definitions and `glob`) are not installed and the environment cannot resolve `registry.npmjs.org`; Docker, Firebase CLI and gcloud are also unavailable.
- No production promotion is approved from this runner. `scripts/promote-prod.sh` requires CI-issued immutable image, release identity, canary evidence and production credentials; none are fabricated locally.

## End-to-End Audit — Alter API, AuthClaims, Browser Security — 7 October 2026

### Discovery / RCA

- **Fehler A — `/api/account/alter`:** The server already contained the authoritative age engine, but the UI independently calculated age with browser-local time and the route accepted a broader set of date syntaxes through the lower-level parser. This created two validation authorities and made `DD.MM.YYYY` vs. ISO behavior dependent on which layer was reached. The public API contract is now explicit: `POST /api/account/alter` accepts `geburtsdatum` only as `YYYY-MM-DD`, validated by Zod before domain processing. Invalid payloads return `400 / INVALID_DATE_FORMAT`; invalid calendar/future/plausibility failures return `400` with differentiated `INVALID_BIRTHDATE*` codes; a new underage result returns `422 / UNDERAGE_RESTRICTION`; an already locked account returns `403 / UNDERAGE_ACCOUNT_LOCKED`.
- **Fehler B — UI error mapping:** The age/consent gate previously converted broad request exceptions and API failures into the same localized “Keine Verbindung” message. The UI now distinguishes network reachability failures from API validation, underage restriction, rate limiting and service failures. The submit action is idempotently guarded while a mutation is active.
- **Fehler C — AuthClaims / browser security:** `validateAuthClaims()` previously emitted `console.warn('AuthClaims validation warning')` for malformed optional claims. Firebase/custom claims can evolve independently of the app's optional claim subset. The validator now normalizes optional fields, drops malformed non-privileged values and accepts privileged booleans only when they are actual booleans, without production-console warnings. The production CSP has explicit `worker-src`, and an explicit Permissions-Policy now allows only the user-initiated camera/microphone flows actually used by the app while disabling geolocation. No obsolete `audio` or `unload` Permissions-Policy feature is declared.
- **Fehler D — age edge cases:** The authoritative age engine already uses Europe/Berlin calendar-day semantics and explicit leap-year handling. Regression coverage includes exact 18th birthday, underage, future date, invalid calendar date, >120-year plausibility and 29-Feb behavior. The client no longer performs a second approximate `365.25`-day age calculation; the server is authoritative.

### Remediation files

- `src/server/routes/account.ts` — Zod API contract and deterministic status/code mapping boundary.
- `src/server/datenschutz.ts` — domain failure mapping to HTTP 400/422/403 and stable error codes.
- `src/components/EinwilligungUndAlter.tsx` — server-authoritative validation, differentiated UI errors, duplicate-submit guard and removal of approximate client age calculation.
- `src/i18n/locales/{de,en,es,fr}.json` — localized technical/domain error states.
- `src/lib/authSessionSchema.ts` — warning-free AuthClaims normalization and safer optional-claim handling.
- `server.ts` — explicit Permissions-Policy for actual media capabilities.
- `src/server/securityHeaders.ts` — aligned fallback header helper with explicit worker policy and non-inline script CSP.
- `tests/accountAlter.spec.ts` — API contract regression tests for 200 adult, 422 underage and 400 non-ISO payloads.
- `tests/authSessionSchema.spec.ts` — malformed-claim normalization regression without console warnings.

### Verification after remediation

PASS: TypeScript/TSX syntax transpilation for all changed files; i18n catalog; naming; accessible labels; CSP directive inventory; Art. 17 deletion audit; deletion cascade; deployment manifests; container-build contract; prohibited glossary-term scan in locale values.

BLOCKED BY ENVIRONMENT: full project TypeScript typecheck, Vitest execution, Vite production build, bundle budget, guardrail script requiring `glob`, Playwright/E2E, emulator-backed rules tests and cloud release evidence. The runner has no installed project dependencies and cannot resolve the npm registry. These are execution-environment blockers and are not reported as product-pass evidence.

### Release conclusion

**PRODUCTION: NOT APPROVED / BLOCKED.** The remediation is production-oriented and statically verified where executable in this runner, but the exact-head dependency-backed test/build/E2E and protected cloud promotion gates remain mandatory before Go-Live.

## Final feature hardening — i18n / Date-prep checklist / Didit KYC — 7 October 2026

### i18n
- `LanguageSwitcher` is mounted through `LanguagePreferenceProvider` and `I18nextProvider` in `src/App.tsx`.
- Supported languages are exactly `de`, `en`, `es`, `fr`.
- The selected language is persisted through the centralized browser-storage boundary under the reviewed global preference key `klar_language`.
- `i18next` updates `document.documentElement.lang` on every language change and also synchronizes cross-tab `storage` events.
- Authenticated users additionally persist the preference server-side through `/api/account/preferences`.
- The catalog gate reports 265 consistent keys/interpolation parameters across all four locales.

### Date-prep checklist
- `src/screens/Tips.tsx` contains no direct `localStorage` access for the date-prep checklist.
- Checklist state is queued in UID-owned IndexedDB (`klar_offline_queue_db`) and flushed through the authenticated `/api/checklists/date_prep` route.
- Firestore is authoritative at `users/{uid}/checklists/date_prep`; server validation rejects malformed/unknown values.
- Added `scripts/check-date-prep-checklist-boundary.mjs` and a dedicated enterprise gate.

### Identity verification / KYC
- The legacy `/api/verification/*` self/manual verification routes remain retired with HTTP 410.
- Only signed Didit V3 events can mutate `users/{uid}.isVerified` and the public profile verification state.
- Webhooks use raw-body canonicalization, HMAC-SHA256, timestamp freshness, application/workflow/environment/session binding, idempotent event receipts and bounded provider decision arrays.
- Added/retained explicit KYC state-machine regression coverage and recent-auth enforcement for KYC session start.
- Restored the missing scheduled reconciliation function in `functions/src/index.ts`: every 15 minutes, Europe-west3, single instance, bounded timeout/retries, dedicated secret and signed internal endpoint.
- Added `scripts/check-isverified-authority.mjs`, `scripts/check-date-prep-checklist-boundary.mjs`, and wired the KYC integrity/reconciliation gates into `check:enterprise`.

### Final verification state
PASS: secrets, auth boundary, public Firestore rules, AI PII sanitizer, Art. 17 deletion audit, i18n, naming, accessible labels, date-prep boundary, UID storage boundary, `isVerified` authority, Didit webhook boundary, Didit KYC integrity and reconciliation.

BLOCKED: `npm run typecheck`, `npm run test:pure`, `npm run test:rules`, `npx playwright test`, `npm run build` because the exact project dependency graph is not installed in this runner. `npm install` was attempted but timed out; offline `npx playwright` confirmed there is no cached Playwright package. No test/build PASS is inferred from static inspection.

**PRODUCTION: NOT APPROVED / BLOCKED.**

## High-End Feature Delivery — 07.10.2026

Implemented and statically verified:
- granular consent center with atomic per-purpose HMAC-SHA256 evidence ledger;
- inactivity/manual privacy screen lock with explicit unlock;
- server-authoritative Date Planner / Calendar / availability state;
- server-validated connection selection, city/region and vibe handling;
- idempotent 2-hour FCM reminder worker;
- UID-scoped IndexedDB + Firestore date-preparation checklist synchronization;
- migration of remaining calendar consumers away from `klar_planned_dates` / `klar_date_availabilities` browser persistence.

The new boundary checks are part of `check:enterprise`.

Dynamic release gates remain environment-blocked in the current runner because project dependencies and Firebase/Playwright tooling are not installed and the npm registry is not reachable from this environment. No production promotion is claimed.
