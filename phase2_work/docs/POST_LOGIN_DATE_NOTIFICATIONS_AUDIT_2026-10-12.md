# Post-login calendar and notification lifecycle audit (2026-10-12)

## Confirmed findings
The DateCalendar loaded date plans on mount without waiting for auth readiness, retained old plans on user transition, and formatted the timestamp with hard-coded `toLocaleString('de-DE')`. This was corrected: the load now waits until auth settles, resets previous user-visible state, disregards late responses on cleanup/UID change, and routes dates through `src/i18n/format.ts` with the selected DE/EN/ES/FR language and local IANA timezone. Invalid values receive a user-visible fallback.

## Scope and outstanding work
This change does **not** establish that all post-login timestamps or notifications are corrected. Remaining investigations must include chat views, the notification service, toast timers, authenticated subscription lifetimes, message delivery, and account switching. Those controls cannot be marked PASS without executing the specified full gates.

## Release verification
The requested `npm run typecheck`, `npm run test:pure`, `npm run test:rules`, `npx playwright test`, and `npm run build` have **not** been executed for this candidate. The available runtime is Node v22.16.0 versus the repository policy v22.23.3 and a complete repository checkout is unavailable here. A successful PR CI at an older SHA would not be a substitute. Current decision: **NO-GO**. No manual GitHub Actions run initiated; reconcile the user's 100-minute cap before remote CI.

## Additional notification fix

The global Layout legal-updates request previously ran before authentication settled and retained notification/acknowledgement state between UIDs. The effect now waits for a settled authenticated user, clears prior user-visible legal notification state on transitions, cancels stale async completions, and reloads on UID changes (commit `d5184342f0b0f3d6a80afe15bfe5f74c2fd598a5`). This is a scoped auth-race correction, not proof that all notifications and message-delivery paths are correct.

## Chat timestamp and read-receipt follow-up (2026-10-12)

Commit `bbed6600f3599492a1d531cf212921b940b5f9d4` normalizes Firestore `Timestamp` values from the chat snapshot to JavaScript `Date` objects prior to rendering; downstream `MessageBubble` uses the central i18n formatter. The asynchronous mark-read flow additionally rechecks active chat subscription and current Firebase UID after `getIdToken()` resolves, preventing late auth transitions from sending a stale receipt. The server remains responsible for authorization and message persistence.

These are code-reviewed mitigations, not full delivery assurances. The exact commit still requires pinned Node toolchain validation, TypeScript, pure/rules tests, Playwright, build and emulator smoke. No claims of a passing full release or production approval are made. Budget guard: no manual Actions runs beyond the user's unreconciled 100-minute ceiling.

## Toast lifecycle follow-up

The InAppNotification countdown previously depended on the identity of `onDismiss`; Layout passes an inline callback, so unrelated parent renders reset the timer. Commit `b7395ac0d1b24cce236b8bd4d9bae5210c75d561` retains the latest callback in a ref without restarting the effect, and `7ad79de9a1afc5b9f348033c67f39e2eef8640db` adds a fake-timer rerender regression. This does not alter intentional reset on a distinct notification or the persistent-notification rule. Tests remain to be validated on the exact latest head; production **NO-GO**.
