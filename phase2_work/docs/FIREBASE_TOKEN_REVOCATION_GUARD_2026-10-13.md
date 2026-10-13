# Firebase token revocation — regression coverage (2026-10-13)

## Baseline
The current GitHub `main` server middleware already invokes `verifyIdToken(idToken, true)`; this change does **not** modify token verification behavior or alter the user's uncommitted Codespace branch. The `true` argument requests revoked-token and disabled-account checking through Firebase Admin. The middleware checks account-deletion-pending state before attaching the verified token to the request.

## Regression gate
`node --test tests/firebaseTokenRevocationPolicy.test.mjs` checks that the middleware continues to request revocation verification, and that the identity assignment follows authentication and deletion-pending checks. This is a **source-policy test**, not runtime proof.

## Remaining release validation
Use isolated Firebase Auth + Firestore emulators to exercise missing/invalid tokens, revoked/disabled sessions and valid tokens; confirm protected endpoints fail closed and that logout revocation invalidates subsequent requests. Check backend handling of Firebase credential/network failures separately; operational errors must not be mistaken for successful authentication. Never place real ID tokens, service-account secrets or PII in test fixtures, logs or commits.

The Codespace `security/v149-autonomous-consolidation` may differ from the GitHub main branch. Do not overwrite uncommitted work. Production release remains **NO-GO** pending full gates and issue #8.

## CI follow-up (2026-10-13)
GitHub CI exposed a test-runner integration issue: `node:test` in a `tests/*.test.mjs` file is discovered by Vitest and fails Vite bundling. The regression suite on this branch now imports `test` and `expect` from `vitest`. Validate via `npx vitest run tests/firebaseTokenRevocationPolicy.test.mjs` and run the full CI suite at the new head SHA. Earlier CI results do not apply to this updated commit.

## CI remediation — Vitest source fixture location
The CI logs of 2026-10-13 showed `ERR_INVALID_URL_SCHEME`: Vite's module URL for the `.test.mjs` policy test is not guaranteed to be a `file:` URL. The test now loads checked-in source fixtures by relative filesystem paths under the repository's `phase2_work` test working directory instead. Validate the updated exact commit SHA with the full CI job before merging; prior failed runs are not evidence of success.
