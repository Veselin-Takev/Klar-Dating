# P0 #56 — Quarantined consent blocks all partner privileges (2026-10-18)

**Draft / NO-GO.** Stacked on PR #100.

After the consent-withdrawal quarantine fix, several downstream partner-referral routes only checked `partnerReferralConsent` and did not honor `partnerReferralEpochQuarantined`. A stale or incorrectly restored consent boolean could thereby expose referral links or enable click and conversion records while the consent history remained quarantined.

This patch treats `partnerReferralEpochQuarantined === true` as ineligible throughout private referral listing, referral creation and interactions, public partner link tracking, transactionally rechecked clicks, conversion buyer and conversion owner. The consent state response also reports `allowed:false` for quarantined accounts. **Withdrawing consent remains allowed** and retains the signed audit and fail-closed re-grant semantics from PR #100.

New Vitest regressions cover denial for quarantined referral listing and quarantined buyer/owner conversions, including a deliberately inconsistent `partnerReferralConsent:true`. No conversion reward is granted. The guard depends on trustworthy Firestore document state; direct writes must be forbidden or independently audited. It is not a substitute for GDPR consent proof or real purchase verification.

Validation: run `npx vitest run tests/partnerReferralService.spec.ts` under Node 22.23.3, Firebase Emulator transactions and HTTP route tests, PII/rules audit, TypeScript, Playwright, build, npm audit and independent Privacy/Legal/Security signoff. New Vitest cases are NOT certified until executed. No merges or production changes, P0 #56 and GO-LIVE #8 remain OPEN.
