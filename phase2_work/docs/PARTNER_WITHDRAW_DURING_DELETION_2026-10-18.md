# P0 #56 – Partner consent withdrawal during account deletion (2026-10-18)

**Draft / NO-GO.** Stacked on PR #102.

## Finding
The transactional `setPartnerConsent` flow refused both new consent and withdrawal whenever `account_deletions/{uid}` existed, returning `account_deletion_pending`. This could prevent someone whose account deletion was queued from promptly revoking partner-data processing consent. Under GDPR Article 7(3), withdrawal must be available at any time and as easy as granting consent (EDPB Guidelines 05/2020: https://www.edpb.europa.eu/documents/guideline/guidelines-052020-on-consent-under-regulation-2016679_en).

## Resolution
An account-deletion record continues to **block any new consent grant**. It no longer blocks `allowed=false`: an existing consent is withdrawn transactionally, consent version updated (or quarantined according to PR #100), a signed withdrawal audit entry created, and repeated withdrawals remain idempotent. A regression test seeds a queued account deletion, verifies grants fail, withdrawal works, ledger is not duplicated, and re-grant remains blocked.

## Release caveats
The profile must still exist: where the deletion worker already removed the user document, `requirePartnerUserData` may reject. Confirm deletion worker itself revokes/invalidates consent before removing the user, and preserves only lawful/minimal audit evidence. This fix is not an assertion that all deletion states comply with Article 7/17. Full Node22.23.3 Vitest, Firestore Emulator, GDPR/PII, concurrency, Firestore rules, typecheck, build and independent Privacy/Legal approvals remain outstanding. No production, main or paid CI actions. **NO-GO**; #56 and #8 remain open.
