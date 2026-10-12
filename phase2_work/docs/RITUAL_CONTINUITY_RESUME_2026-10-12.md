# Ritual continuity resume — 2026-10-12

## Root cause
ConsistencyStreakWidget displayed "Pausiert (7T)" but only rendered a pause-start action when **not** paused; there was no resume handler. DatingRituals also overwrote `klar_rituals_streak` on a new completion, silently discarding `vacationUntil`.

## Fix
The widget now renders an accessible 44px minimum "Fortsetzen" button while paused. It removes the vacation marker, persists the change in the existing UID-scoped klarStorage entry, dispatches the same ritual-change event and updates the UI. Resume does not fabricate a completed ritual or increase earned days; a one-day `resumeGraceUntil` field lets the prior count remain visible until an actual completion. Real completions during vacation preserve the pause marker; a real completion during grace can continue the streak. Failure to persist is announced and does not claim success.

## Data architecture and important constraint
The observed ritual streak source of truth is `klarStorage('klar_rituals_streak')`, not Firestore. This PR intentionally does **not** introduce speculative Firestore writes, new security rules or unreviewed migration of behavioral data. Cross-device Firestore persistence, permissions, and retention must be designed and verified separately before declaring cross-device consistency. The separate `SmartPause` feature is unrelated to the seven-day streak vacation.

## Verification
Added regression coverage in `tests/ritualResume.spec.tsx`. The full required gates (`npm run typecheck`, `npm run test:pure`, `npm run test:rules`, `npx playwright test`, `npm run build`) have not been independently run in this environment. Exact-head CI, Firestore migration review, and production authorization remain pending. No production-ready project ZIP or GO claim; no manual GitHub Actions runs.
