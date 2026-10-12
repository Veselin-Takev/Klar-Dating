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

## Toast event identity and late-dismiss protection (2026-10-12)

Identified: Layout keyed toast components only by title; consecutive notifications with the same title reused the same rendered instance and countdown. Moreover, a deferred dismiss callback from an earlier notification could clear a newer notification. Commit `f1a1a437c4d6ea0083c137f08f99e61fe05ecbf1` assigns a distinct monotonically increasing notification ID to each accepted event/legal notice, keys the component by that ID and guards onDismiss against an obsolete ID. External event payloads now require a nonempty string title and sanitize optional text/persistent flags instead of casting arbitrary event detail. Registered notification state and server authority remain distinct.

Exact-head CI and integration verification remain mandatory; this commit has not received a verified passing run as part of this record. Release stays **NO-GO**. Do not start remote runs beyond the user's unreconciled Actions budget cap.

## Legal acknowledgement and authentication transition (2026-10-12)

The async legal acknowledgement handler previously applied the response to local state even if the active account had changed after the request began. Commit `db1d9ad7eb51db10667223786d01509d1a0231a6` captures the authenticated UID at request start and rechecks the latest authenticated UID after the response. Unauthenticated requests and late responses for a previous identity are not acknowledged in the current UI. Server authorization and persistence remain authoritative; client validation is defense in depth.

**Validation:** This targeted fix has been committed but not independently verified by the full release gates at the current head. The prior run `38278365523` was observed pending; do not infer a PASS at later SHAs. The project's production release remains **NO-GO** pending tests and operational evidence. GitHub Actions spending stays subject to the owner's 100-minute budget ceiling.

## Regression gate: asynchronous acknowledgement ownership

The latest previously observed exact-head workflow `38278518562` for commit `56b8219fc19cb6e5fc7ee99aedf2b4dcdaf59395` completed successfully. Subsequently, commits `2ca37577a783d1f78a06d88a98b43cc1b7fb797f`, `9349975161911dd06429952713151e369d787579`, and `40e90de156eb2cb27038854990c3f399e03b9fe4` extracted and exercised the UID ownership predicate for async legal notice acknowledgement. Unit tests cover same UID, logout, changed UID, and absent identity; they **do not** replace full UI integration, simultaneous pending request, or session-generation tests (including logout and reauthentication to the same UID). No independent passing test result for these new commits is asserted. Production **NO-GO** pending exact-head gates and Issue #8 evidence. No manual remote CI runs launched; cumulative GitHub Actions minutes still require reconciliation.
