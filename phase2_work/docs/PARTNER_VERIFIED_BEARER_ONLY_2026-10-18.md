# P0 #56 — Partner redirect: verified bearer identity only (2026-10-18)

**State: Draft / NO-GO.** GitHub main remains unchanged.

## Finding
The optional visitor lookup for /partner/click/:token returned req.user.uid before invoking verifyIdToken(token, true). A prepopulated identity could therefore bypass the fresh Firebase revocation check introduced in the previous draft. The public click path must not trust this alternate boundary to permit external token attribution.

## Change
The helper ignores prepopulated request UID for attribution. An explicit Authorization Bearer Firebase ID token must pass Firebase Admin verifyIdToken(token, true); anonymous providers and invalid/revoked/disabled tokens yield no visitor identity. On absent or invalid bearer, the existing service redirects to the validated partner destination without a referral attribution token, provided the campaign is active. No permission is granted on failed checks.

## Compatibility and risk
Ordinary browsers navigating links usually cannot attach an Authorization header. Consequently most navigations will no longer receive attribution; this is a conservative fail-closed restriction, not a finished consent-aware referral flow. Review product requirements and design a user-initiated authenticated POST + short-lived redirect ticket with privacy and CSRF analysis before restoring attributed navigation. Firebase revocation verification incurs an additional network request. No conversion or reward logic is made more permissive.

## Tests and release
Run node scripts/check-partner-visitor-auth-boundary.mjs from phase2_work. This static source guard does not prove HTTP behavior. Execute authenticated, anonymous, missing-header, malicious req.user, revoked, disabled, malformed-token, and Firebase Auth failure tests using the emulator and real middleware as appropriate. Complete pinned Node 22.23.3 typechecks, tests, rules, Playwright, build and independent Security/Privacy review. Verify no tracking leakage, HTTP redirects and metrics. No deploy, cloud changes or release approval. P0 #56 and #8 remain OPEN.
