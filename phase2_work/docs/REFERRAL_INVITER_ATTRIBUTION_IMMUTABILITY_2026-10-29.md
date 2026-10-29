# Referral inviter attribution immutability — Issue #48 (2026-10-29)

**Draft. Production NO-GO.** Base main SHA `2808dc1cbb485f70b403681c108cea5a3361d950`.

## Verified finding

The existing `POST /referral/claim` transaction returned `true` whenever the invitee profile already had any truthy `referredBy`. A claim for a different inviter was therefore reported as successful, although attribution was never changed. This is a misleading acceptance boundary in the Member Referral 2.0 flow and can hide attempted reattribution.

## Correction

Inside the same Firestore transaction and after account deletion / inviter-code eligibility checks, the service now returns success for an already-attributed invitee **only if** `referredBy === inviterRef.id`. A different inviter returns the existing HTTP 409 `Einladung für dieses Konto derzeit nicht verfügbar.`. No rewards, KYC status or referral attribution are mutated on mismatch. An exact retry by the original inviter remains successful and write-free. The HTTP regression uses the repository's transaction-oriented Firestore double and checks both responses, preserved inviter identity and zero writes.

## Release boundary

This narrows an identity/attribution claim but does not implement signed single-use referral tokens, verified-person safeguards, fraud controls, rewards, or full Art.17 cleanup. Requires exact-HEAD Enterprise CI; emulator concurrency and independent threat-model reviews remain P0 #48 gates. No direct main commit, merge or deployment. **NO-GO**.
