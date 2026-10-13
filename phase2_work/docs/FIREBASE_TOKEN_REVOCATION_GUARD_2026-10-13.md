# Firebase token revocation — regression coverage (2026-10-13)

## Baseline
The current GitHub `main` server middleware already invokes `verifyIdToken(idToken, true)`; this change does **not** modify token verification behavior or alter the user's uncommitted Codespace branch. The `true` argument requests revoked-token and disabled-account checking through Firebase Admin. The middleware checks account-deletion-pending state before attaching the verified token to the request.

## Regression gate
`node --test tests/firebaseTokenRevocationPolicy.test.mjs` checks that the middleware continues to request revocation verification, and that the identity assignment follows authentication and deletion-pending checks. This is a **source-policy test**, not runtime proof.

## Remaining release validation
Use isolated Firebase Auth + Firestore emulators to exercise missing/invalid tokens, revoked/disabled sessions and valid tokens; confirm protected endpoints fail closed and that logout revocation invalidates subsequent requests. Check backend handling of Firebase credential/network failures separately; operational errors must not be mistaken for successful authentication. Never place real ID tokens, service-account secrets or PII in test fixtures, logs or commits.

The Codespace `security/v149-autonomous-consolidation` may differ from the GitHub main branch. Do not overwrite uncommitted work. Production release remains **NO-GO** pending full gates and issue #8.
