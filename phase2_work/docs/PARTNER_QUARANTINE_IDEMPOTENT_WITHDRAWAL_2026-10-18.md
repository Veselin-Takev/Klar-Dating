# P0 #56 – Repeated quarantined consent withdrawal is idempotent (2026-10-18)

**DRAFT / NO-GO.** Stacked on draft #101.

## Finding
A quarantined partner-consent profile has `partnerReferralConsent=false` and may retain an invalid `partnerReferralVersion`. In `setPartnerConsent(false)`, that state previously fell through to a generic update that silently wrote a default version 1 and created a second withdrawal audit entry. This defeated the quarantine's preservation of uncertain consent history.

## Fix
Repeated `allowed=false` requests while `partnerReferralEpochQuarantined=true` and `partnerReferralConsent` is not true return `{allowed:false,version:null}` **without any database mutation or new ledger entry**. The initial withdrawal still creates a signed audit, disables consent and flags quarantine; re-grant is blocked until a separately authorized remediation. Version history remains unchanged.

## Verification and unresolved controls
In-memory Vitest asserts two consecutive withdrawals produce one ledger entry and unchanged quarantined profile. Run under Node v22.23.3 with dependencies and Firebase Emulator transactional tests, then full typechecks, Rules, Playwright, security and build gates. Review deletion-in-progress consent semantics and existing client compatibility with nullable version. All partner rewards remain pending independent purchase and buyer evidence. No merge, CI rerun or deployment. Privacy/Legal/Security signoff outstanding, #56/#55/#8 OPEN, **NO-GO**.
