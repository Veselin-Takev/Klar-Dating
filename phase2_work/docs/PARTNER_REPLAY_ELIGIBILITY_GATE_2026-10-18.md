# P0 #55 — Partner webhook replay eligibility recheck (2026-10-18)

**Release state: DRAFT / NO-GO.** The change builds on the event-binding safeguard (#81), and it does not certify a real purchase or buyer identity.

## Finding
The partner-conversion transaction returned `duplicate: true` as soon as an existing signed event ID and event HMAC binding matched. That occurred *before* checking current buyer/owner consent, active campaign, age, account-deletion records, and referral-version revocation. Consequently, after a buyer revoked partner consent, a provider replay could still receive a positive `already_recorded` acknowledgement.

## Implementation
Keep the event binding comparison, but perform it **after** transactional buyer, owner, deletion, and campaign checks. An exact replay with current eligibility remains idempotent; changed event bindings still conflict; revoked/ineligible event retries fail with `conversion_not_eligible`. Nothing is credited: new assertions remain `pending_verification` and partner signatures alone never prove purchase settlement.

## Tests and compatibility
An in-memory Vitest regression in `tests/partnerReferralService.spec.ts` seeds a valid claim, confirms an exact replay, revokes buyer consent, then expects the next replay to be denied without creating a second conversion or modifying counters. Run `npx vitest run tests/partnerReferralService.spec.ts` with pinned Node 22.23.3 and dependencies. The test uses a mock and does not demonstrate true Firebase Emulator contention or the webhook HTTP signature boundary.

**Behavior change:** Some providers may retry an event after consent withdrawal and now receive 403 rather than 200 duplicate; avoid repeated retries through separately approved provider contract semantics, without conceding authorization. Review whether a minimal, non-personal replay acknowledgement can be designed to preserve privacy and provider retry efficiency. Require Security/Privacy/Finance approval, emulator concurrency tests, full mandatory gates, authenticated purchase evidence and legal retention mapping before release.

No production/staging cloud changes, GitHub main merge, or paid CI started. P0 #55 and GO-LIVE #8 remain open.
