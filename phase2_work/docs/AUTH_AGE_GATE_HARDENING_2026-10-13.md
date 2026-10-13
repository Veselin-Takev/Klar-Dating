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
