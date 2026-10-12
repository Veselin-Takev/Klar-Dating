# Post-login calendar and notification lifecycle audit (2026-10-12)

## Confirmed findings
The DateCalendar loaded date plans on mount without waiting for auth readiness, retained old plans on user transition, and formatted the timestamp with hard-coded `toLocaleString('de-DE')`. This was corrected: the load now waits until auth settles, resets previous user-visible state, disregards late responses on cleanup/UID change, and routes dates through `src/i18n/format.ts` with the selected DE/EN/ES/FR language and local IANA timezone. Invalid values receive a user-visible fallback.

## Scope and outstanding work
This change does **not** establish that all post-login timestamps or notifications are corrected. Remaining investigations must include chat views, the notification service, toast timers, authenticated subscription lifetimes, message delivery, and account switching. Those controls cannot be marked PASS without executing the specified full gates.

## Release verification
The requested `npm run typecheck`, `npm run test:pure`, `npm run test:rules`, `npx playwright test`, and `npm run build` have **not** been executed for this candidate. The available runtime is Node v22.16.0 versus the repository policy v22.23.3 and a complete repository checkout is unavailable here. A successful PR CI at an older SHA would not be a substitute. Current decision: **NO-GO**. No manual GitHub Actions run initiated; reconcile the user's 100-minute cap before remote CI.
