# Auth age and consent gate hardening — 2026-10-13

## Change
The second `/api` middleware now responds with HTTP 401 and `auth_required` when a protected request reaches the age/consent gate without `req.user.uid`. Previously it called `next()`, which could bypass the gate if upstream route ordering or authentication changed.

The explicitly public routes and routes exempt from the age prerequisite still bypass the age gate at their existing earlier branches; the upstream `requireAuth` middleware continues to govern routes that require Firebase authentication. This is defense in depth, not a substitute for evaluating all route registration order.

## Evidence and limits
- Source-policy regressions: `node --test tests/authAgeGatePolicy.test.mjs`.
- Required before merging: `npm run typecheck`, authenticated/unauthenticated HTTP integration tests against the isolated Firebase emulator, and the repository release gates.
- Static tests check the guard's presence and ordering, **not** request-time behavior.
- This branch is based on `main`. The user's Codespace branch `security/v149-autonomous-consolidation` has uncommitted edits to other files; do not force-checkout, reset or merge without reconciliation.
- `verifyIdToken(idToken, false)` remains an independent revocation-risk audit item; token verification semantics have not been changed here.

Production release remains **NO-GO** pending issue #8, exact-head-SHA CI, and operational signoff.

## CI follow-up (2026-10-13)
GitHub CI exposed a test-runner integration issue: `node:test` in a `tests/*.test.mjs` file is discovered by Vitest and fails Vite bundling. The regression suite on this branch now imports `test` and `expect` from `vitest`. Validate via `npx vitest run tests/authAgeGatePolicy.test.mjs` and run the full CI suite at the new head SHA. Earlier CI results do not apply to this updated commit.

## CI remediation — Vitest source fixture location
The CI logs of 2026-10-13 showed `ERR_INVALID_URL_SCHEME`: Vite's module URL for the `.test.mjs` policy test is not guaranteed to be a `file:` URL. The test now loads checked-in source fixtures by relative filesystem paths under the repository's `phase2_work` test working directory instead. Validate the updated exact commit SHA with the full CI job before merging; prior failed runs are not evidence of success.
