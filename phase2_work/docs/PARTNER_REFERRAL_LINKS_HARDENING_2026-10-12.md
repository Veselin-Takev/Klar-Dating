# Partner referral links availability hardening — 2026-10-12

## Reproduced code-path diagnosis
The profile widget calls authenticated GET /api/partner/consent then GET /api/partner/referrals after confirmed consent. The server requires a registered adult account, explicit persisted partner consent and, for administrative campaign mutation, an independent Firebase admin custom claim. The server uses Admin Firestore, not user-facing Firestore reads; weakening client Firestore Security Rules would not address this failure.

The link listing function in src/server/partnerReferralService.ts called publicOrigin() **before** checking whether any active, brand-verified campaigns existed. On an installation with zero active campaigns and no configured public URL, it returned HTTP 503 rather than the valid empty list. This is a code-path cause of the displayed generic “Die Partnerlinks konnten nicht geladen werden.” It does not prove that the specific reported deployment has a missing public URL; that requires environment/response diagnostics.

## Changes
- A verified adult account with persisted consent and no active campaigns now receives `{ consent: { allowed: true }, referrals: [] }` before requiring a public origin. Actual personalized links still require a valid origin and the existing cryptographic token/ledger checks.
- The UI converts referral fetch errors to a non-sensitive, retryable notice and uses request sequencing to prevent late fetch results overwriting the state after consent withdrawal.
- Regression tests exercise empty campaigns without configured public URL and reject link retrieval where consent is absent.
- Consent remains server-authoritative; no local checkbox state is treated as signed HMAC-SHA256 evidence. Campaigns are not invented if none are active.

## Outstanding release gates
The required `npm run typecheck`, `npm run test:pure`, `npm run test:rules`, `npx playwright test`, and `npm run build` have not been executed in a complete local checkout. Exact-head CI, browser tests with registration/withdrawal during pending network requests, secrets configuration, and independent privacy/security approval remain necessary. The complete production-ready ZIP is not available from the GitHub connection alone. Do not infer production GO. GitHub Actions usage remains subject to the previously agreed 100-minute cap; no manual runs.
