# Member referral Firebase identity-claim gate — Issue #48
**2026-10-30 · Candidate Draft · PRODUCTION BLOCKED / NO-GO**

## Grounded source finding
The deployed server's `requireAuth` middleware verifies Firebase Admin ID tokens with revocation checks and populates `req.user = decodedToken`. However, the targeted member-referral gate in Draft #214 only rejected when `req.user?.firebase?.sign_in_provider === 'anonymous'`. It **allowed missing, blank or malformed provider claims** (and a UID mismatch in a nonstandard integration) past this extra eligibility gate. Those cases are not demonstrated to occur in production; this fix protects against incomplete/miswired route integrations or legacy identity data.

## Minimal code changes
`src/server/routes/launch.ts` now requires:
- non-empty `deps.currentUserId(req)` before checking member eligibility, otherwise 401;
- `req.user.uid === deps.currentUserId(req)`, otherwise generic 403;
- a nonempty string `req.user.firebase.sign_in_provider` with a non-whitespace value, **and not `anonymous`**, otherwise generic 403.

The gate runs **before Firestore-backed distributed limiters**, referral issuance or claim queries. It does not assert that an identity provider by itself proves adulthood, consent, Didit KYC, qualification or entitlement. It does not change public launch-summary, activation, account deletion, or B2B partner flows. It relies on the existing signed-token verification middleware rather than trusting a client-supplied provider string.

## Regression coverage
`tests/launchEndpoint.spec.ts` now seeds a complete synthetic Firebase request context for the standard test helper (permanent password provider, `uid` consistent with the test principal). Negative HTTP tests cover missing provider object, empty and whitespace provider claims, inconsistent UID vs caller, and no authenticated UID; both `GET /referral` and `POST /referral/claim` are refused before any Firestore/limiter access. Existing anonymous-session refusal, registered first issuance, code uniqueness, competing claims and deletion-marker tests remain in place. Emulator tests use separately injected synthetic password-provider request contexts and are **not** actual JWT authentication checks.

**New exact-head CI is NOT yet verified.** Require full TypeScript, enterprise static gates, test:ci, real `demo-klar` Firestore emulator tests, build/browser acceptance and positive authorized Firebase-ID-token staging checks. Never inherit #217's PASS from a different source head.

## Backwards compatibility and remaining trust limits
If any legacy/mobile path supplies a UID but not a verified `firebase.sign_in_provider` claim, member referrals intentionally deny 403. A release gate must inventory/migrate such clients, verify actual Firebase Admin mapping (including OAuth/custom-token cases), and confirm correct registered-account behavior without recording raw ID tokens. No secrets, real customer profile lookups, real partner callbacks or production Firebase write/read are authorized by this candidate.

All referral rewards must remain unavailable until server-authoritative Didit identity, age/consent, expiry, anti-Sybil, duplicate-entitlement/reversal and Art.17 are approved and demonstrated. The atomic code-reservation/legacy migration design is still open (query-based issuance defenses alone are not a global uniqueness proof).

## Change control
Isolated Draft feature branch stacked on [#217](https://github.com/Veselin-Takev/Klar-Dating/pull/217). Freeze PR #119 and RC R2; do not merge, deploy, trigger workflows manually or change `main`. P0 #48/#55/#56/#70/#202 and release #8 remain open. **NO-GO**.
