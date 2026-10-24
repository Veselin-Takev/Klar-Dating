# Partner visitor authentication boundary — 2026-10-18

**Issue:** P0 #56. **Decision:** Draft / production **NO-GO**.

## Threat and change
The public click route can identify a visitor through prepopulated Firebase `req.user` claims or by independently verifying an Authorization Bearer ID token. Prior to this patch, `optionalVisitorUid` could treat an anonymous Firebase account as an attributable visitor, provided the Firestore profile otherwise satisfied adult and consent checks.

Now both trust paths explicitly reject `firebase.sign_in_provider === 'anonymous'`. Anonymous sessions remain able to follow the untracked direct partner destination (subject to the existing campaign and rate-limit checks), but cannot cause an attribution token to be appended or a click to be credited. Invalid JWTs also remain fail-closed. Existing owner consent, independent visitor consent, age and account-deletion transaction checks on the underlying service are preserved.

## Evidence, staging and acceptance
Run `node scripts/check-partner-visitor-auth-boundary.mjs` from `phase2_work`. This is **static** source-pattern verification; it is not proof of runtime Firebase token behavior. Before release, add and execute HTTP integration tests for prepopulated anonymous claims, anonymous Firebase ID tokens, regular authenticated JWTs, revoked/missing visitor consent, missing Authorization and malformed headers. Run mandatory pinned Node 22.23.3 TypeScript/Vitest/Firebase Emulator/Playwright/build/security gates and obtain independent Privacy/Security sign-off.

## Compatibility, rollback and limitations
Expected effect: anonymous Firebase visitors are redirected without partner attribution or click counting. If partner analytics relied on anonymous visitor tracking, counts will decrease; validate metrics and contractual implications, do not re-enable silently. No migrations required. Reverting these route changes restores a weaker privacy boundary and requires separate authorization. All existing token persistence, third-party recipient review, Art.17 cascade and TTL/legal-hold controls remain independent P0 release blockers. No production environment or paid CI touched.
