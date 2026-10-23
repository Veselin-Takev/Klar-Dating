# P0 #55/#56 — Consent-writer epoch integrity gate (2026-10-18)

**Status: DRAFT / NO-GO.** Stacked on PR #98.

## Confirmed boundary
Prior fixes reject conversion assertions for missing/malformed buyer consent epochs, but `setPartnerConsent` still called `requirePartnerUserData`, which defaults a missing user epoch to 1. For an already-consented user, a subsequent consent update (including a repeated allow=true request) could silently assign epoch 1 and falsely legitimize existing authorization history.

## Change
When `partnerReferralConsent === true`, both grant-idempotence and withdrawal now reject absent, nonnumeric, fractional, nonpositive or unsafe `partnerReferralVersion` with 409 `partner_consent_epoch_inconsistent`. The service does not overwrite profile data or create an audit entry on rejection. An explicit new grant from a *currently denied* legacy profile may initialize epoch 1 under the existing business flow; that behavior is not a substitute for reconciling malformed previously granted consent. Withdrawals at `Number.MAX_SAFE_INTEGER` fail closed with 409 `partner_consent_epoch_exhausted` rather than creating an unsafe epoch.

## Verification
An in-memory Vitest test verifies that six invalid existing-grant epochs fail both true/false writes with no audit creation or mutation, and checks safe-integer overflow on withdrawal. Run `npx vitest run tests/partnerReferralService.spec.ts` with pinned Node v22.23.3 and dependencies; also verify with the Firestore Emulator and all full gates. The mock does not prove serializability or Firebase Rules behavior. Direct database writers and any user onboarding code that mutate `partnerReferralVersion` must be audited independently.

## Remaining risks
If a legitimate consented user has a corrupt or legacy epoch, neither grant nor withdrawal through this endpoint can repair it. Support an independently reviewed, minimal-data administrative quarantine and safe withdrawal path; never silently infer user consent. Require Privacy/Legal approval and an explicit migration policy. This does not establish real purchase or buyer identity. No deployments, merges or Actions reruns. P0 #55/#56 and go-live #8 remain open; **NO-GO**.
