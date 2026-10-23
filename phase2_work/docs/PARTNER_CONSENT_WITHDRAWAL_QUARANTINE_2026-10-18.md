# P0 #56 — Immediate withdrawal despite corrupt consent epoch (2026-10-18)

**Draft / NO-GO**, stacked on PR #99. This change corrects an unintended consequence of the stricter partner-consent version gate.

## Finding
Prior gate rejected `setPartnerConsent(false)` for a user whose consent was currently true but whose `partnerReferralVersion` was missing/corrupt, and rejected withdrawal at MAX_SAFE_INTEGER. This could prevent a user from withdrawing partner-data processing consent, in tension with the requirement that withdrawal is easy and promptly effective.

## Correction
The service now **always permits a withdrawal** when consent is currently true, even if the version is missing, malformed, or exhausted. In a Firestore transaction it sets `partnerReferralConsent: false`, `partnerReferralEpochQuarantined: true`, and `partnerReferralConsentUpdatedAt`, while preserving the corrupt/original version unchanged. It writes a signed `partner_consent_withdrawn` audit entry with `epochQuarantined: true`, and returns `{allowed:false,version:null}` to avoid claiming a made-up version. A future `allowed:true` request on a quarantined profile fails with HTTP 409 `partner_consent_epoch_quarantined` until explicit, documented privacy-approved migration.

Correctly versioned profiles follow the existing deterministic monotonic withdrawal path. The new tests cover missing/null/noninteger/unsafe version and MAX_SAFE_INTEGER withdrawal, no silent epoch rewrite, a recorded audit entry and blocked re-grant.

## Risks, migrations, mandatory gates
`version:null` on quarantined withdrawals is a new response shape; audit existing clients, analytics and UI consumers before deployment. Quarantined accounts must still be able to view and exercise withdrawal; display it as disabled rather than requiring a fabricated version. An authorized admin privacy workflow for releasing quarantine does not yet exist. The current function still refuses changes during a pending account-deletion record; verify deletion worker behavior and identity cleanup separately. Review all other partner privilege checks for `partnerReferralEpochQuarantined`, guard against direct database mutation, and ensure HMAC audit payload includes the new quarantine fields.

Run `npx vitest run tests/partnerReferralService.spec.ts` under pinned Node 22.23.3, Firebase Emulator transactional tests, full typechecks, Playwright, PII and DSGVO Art. 7/17 review. A successful local static test does not constitute production readiness. No merge, production deploy, or GitHub Actions rerun. P0 #56 and #8 remain OPEN. **NO-GO.**
