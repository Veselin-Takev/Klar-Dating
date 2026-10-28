# Partner referral list account-deletion read boundary — Issue #56 (2026-10-28)

**Draft; Production NO-GO.** Baseline main `2808dc1cbb485f70b403681c108cea5a3361d950`.

## Verified finding

`listPartnerReferralLinks()` previously read `users/{uid}` and then listed campaigns, returning `{consent:{allowed:true}, referrals:[]}` when no campaigns existed. It did not check `account_deletions/{uid}` before returning this private response. `ensureReferralForCampaign()` already checked the deletion marker for link creation, but that guard was not reached for the empty-list case.

## Correction

The private list now reads the user record and account deletion marker in one read-only Firestore transaction before it can disclose consent status or enumerate campaigns. A marker returns explicit 409; an incomplete transaction result returns 503 and unavailable Firestore rejects closed. Existing transactional link creation remains independently guarded against deletion/consent changes. Two regression tests cover pending deletion on the zero-campaign path and a failed deletion-marker lookup.

## Verification and limitations

The owner state transaction and later campaign query/response are separate snapshots: this read guard does not claim to close a deletion marker appearing after the transaction commits. No third-party token is released by the empty-list path. CI on exact PR HEAD, emulator concurrency evidence, complete Art.17 cascade, DPO/Security review, third-party contracts and retention approval remain mandatory. No changes to main or production resources. **NO-GO**.
