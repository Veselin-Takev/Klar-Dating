# Partner referral list account-deletion read boundary — Issue #56 (2026-10-28)

**Draft; Production NO-GO.** Baseline main `2808dc1cbb485f70b403681c108cea5a3361d950`.

## Verified finding

`listPartnerReferralLinks()` previously read `users/{uid}` and then listed campaigns, returning `{consent:{allowed:true}, referrals:[]}` when no campaigns existed. It did not check `account_deletions/{uid}` before returning this private response. `ensureReferralForCampaign()` already checked the deletion marker for link creation, but that guard was not reached for the empty-list case.

## Correction

The private list now reads the user record and account deletion marker in one read-only Firestore transaction before it can disclose consent status or enumerate campaigns. A marker returns explicit 409; an incomplete transaction result returns 503 and unavailable Firestore rejects closed. Existing transactional link creation remains independently guarded against deletion/consent changes. Two regression tests cover pending deletion on the zero-campaign path and a failed deletion-marker lookup.

## Verification and limitations

The owner state transaction and later campaign query/response are separate snapshots: this read guard does not claim to close a deletion marker appearing after the transaction commits. No third-party token is released by the empty-list path. CI on exact PR HEAD, emulator concurrency evidence, complete Art.17 cascade, DPO/Security review, third-party contracts and retention approval remain mandatory. No changes to main or production resources. **NO-GO**.

## Firestore emulator integration added (2026-10-28)

Enterprise CI `40770661354` passed on original PR commit `3a6a81a2f978a1e94d806acddad4c935a41e8f09`. The additional `tests/partnerReferralListDeletionEmulator.spec.ts` checks real Firestore transaction behavior for (1) a pending deletion marker with an empty partner campaign list (must return 409 and create no owner referral), and (2) a consenting active user with no campaigns (permitted empty result). The suite rejects non-loopback Firestore hosts, incorrect emulator port, non-demo project IDs, production runtime and durable-store fallback before any Admin client setup. Test records use random IDs and are cleaned up. The database mock tests continue to cover missing snapshot/availability separately. Neither integration test proves a simultaneous deletion-write race, complete Art.17 deletion, or a live production data audit. New exact-HEAD CI and independent DPO/Security/Operations signoff are required. **NO-GO**.
