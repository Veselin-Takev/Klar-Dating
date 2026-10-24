# P0 #55/#56 — Fail-closed buyer consent epoch validation (2026-10-18)

**Draft / NO-GO**, stacked on #97.

## Finding and correction
The buyer consent-epoch guard used `partnerReferralVersion ?? 1` semantics for missing, malformed or unsafe numbers. Such an inferred historical consent epoch could allow a partner assertion to be created without evidence of the buyer's actual consent-period version. The conversion transaction now requires a number that is a positive safe integer. Missing, null, zero, negative, fractional, string and unsafe values are rejected with 403 `buyer_consent_epoch_missing` before a conversion record, buyer-claim or audit entry is written. Replay checks continue to demand the stored event and buyer-claim epochs equal the current version.

This is intentionally **strict** for conversion claims and does not auto-migrate legacy profiles. Existing profiles with a valid consent boolean but no valid epoch require a separately audited, user-facing consent migration. Do not assign epoch 1 by fiat. Confirm `setPartnerConsent` and any other writers establish monotonic versions when granting, revoking and re-granting partner consent; direct Firestore mutation is not an acceptable migration.

## Tests and policy limits
Added seven negative epoch fixtures to `tests/partnerReferralService.spec.ts`, including missing, null, zero, negative, fraction, string, and unsafe integer, then restored the valid profile. Run `npx vitest run tests/partnerReferralService.spec.ts` under Node 22.23.3 with installed dependencies and then real Firebase Emulator tests. Review browser and mobile treatment of the new 403 code and migration procedure with Privacy/Legal before rollout.

This does not prove actual purchase or buyer identity. No production or staging deployment, GitHub Actions rerun or main merge. Full TypeScript/Vitest/Emulator/Playwright/security/build gates and independent Security, Finance and Privacy approvals remain pending. **NO-GO**.
