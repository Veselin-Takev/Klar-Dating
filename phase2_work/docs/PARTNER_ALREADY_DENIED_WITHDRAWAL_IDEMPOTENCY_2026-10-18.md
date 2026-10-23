# P0 #56 — Idempotent withdrawal for already-denied consent (2026-10-18)

**Status:** Draft / NO-GO. Stacked on PR #104.

## Finding
Previously, when partnerReferralConsent was already false and the profile was not quarantined, repeating setPartnerConsent(false) passed through the generic writer. For legacy users with a missing, null, malformed or zero partnerReferralVersion, requirePartnerUserData defaulted the version to 1, thereby creating fabricated version history, a changed timestamp and an extra audit entry for an action that had already taken effect.

## Change
Inside the existing transaction, once account deletion and missing-profile cases have been handled, any **already-denied** consent returns without a database update or ledger append. If the version is a positive safe integer and not quarantined, the response preserves the existing version; otherwise it returns version:null. New grants and actual withdrawals from true consent remain governed by the strict version, quarantine, account deletion and audit checks. The profile is never silently backfilled by a no-op withdrawal.

## Regression and rollout
An in-memory Vitest test covers absent, null, zero, string and valid numeric consent versions and repeats the withdrawal twice per fixture, asserting neither profile nor ledger mutation. Run under pinned Node v22.23.3 with dependencies and confirm with Firebase Emulator transaction tests. Audit all callers for version:null compatibility. Do not interpret this fix as sufficient for GDPR Art. 7/17 proof or automatic production readiness. Full TypeScript, Vitest, Firebase rules, Playwright, dependency audit, build, independent Privacy/Legal/Security review and actual purchase verification remain open.

No merge, paid GitHub CI rerun or cloud deployment. P0 #56 and go-live #8 OPEN. **NO-GO.**
