# Profile photo and text-import persistence — 2026-10-13

## Confirmed source defects
- `src/screens/Profile.tsx` called `updateProfileData({ photoURL: url })` without awaiting or catching the returned promise, after `ladeProfilfotoHoch` uploaded the cropped image. UI could retain stale profile state and asynchronous persistence failures could be unhandled.
- Manual text import called `parseProfileImport`, but then wrote bio and interests only to local React state / UID-scoped browser storage. It never awaited the Firestore-backed `updateProfileData`. Import could appear successful without the server acknowledging changes.

## Changes
- Photo: show a saving status, await Firebase Storage upload and Firestore-backed profile update, refresh the profile view, and display an accessible status message. Errors are caught; no success notice on failure.
- Text import: validate nonempty parsed output, persist the combined bio/interests update through **one** `updateProfileData` operation, then update local state, close the import panel and clear the draft only after confirmation. On failure the input remains available for retry, with an accessible message.
- Structural regression guards added at `tests/profilePersistenceContracts.spec.ts`. These are NOT substitutes for Firebase emulator and real browser tests.

## Residual risk and release controls
`ladeProfilfotoHoch` already writes `photoURL` directly to Firestore after upload, while `updateProfileData` re-confirms it. These are not a distributed transaction across Storage and Firestore. A failure after the Storage object is uploaded can leave an orphan; cleanup and idempotent retries require a separate approved storage-retention design. No blind retries, claim bypasses, or client-originated storage-rule changes were introduced. Confirm Firebase Storage rules and MIME/size policies before production.

All requested full gates (`npm run typecheck`, `npm run test:pure`, `npm run test:rules`, `npx playwright test`, `npm run build`) remain **unverified** in the current connector-only environment. Complete production ZIP not generated. Release **NO-GO** pending exact-head CI, end-to-end browser/emulator review, and authorized production operations evidence (#8). Avoid manual Actions runs without reconciling the agreed minute allowance.
