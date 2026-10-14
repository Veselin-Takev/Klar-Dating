# Partner conversion: fail-closed quarantine (2026-10-14)

**P0 issue #55 — DRAFT / BREAKING API SEMANTICS / NOT READY TO MERGE.**

## Confirmed gap
The current signed callback `qualified_conversion` contains partner-declared `buyerUid` and `referralToken`. A valid HMAC proves possession of the partner signing key, not an independently authenticated purchase or buyer attribution. Historically the transaction immediately wrote `rewardStatus: earned` and incremented `qualifiedConversions`.

## Candidate remediation
For new callback events only, persist an idempotent conversion claim with `rewardStatus: pending_verification` and `proofStatus: partner_assertion_only`, and sign the audit record with the same pending state. **Do not increase campaign/referral qualified conversion counters.** The duplicate reply remains `already_recorded`. The initial buyer claim remains reserved to avoid multiple pending credits.

This is *quarantine only*, not the full verification solution. It intentionally changes the webhook response contract from `earned` to `pending_verification`. Existing historical earned records and counters are **not retroactively reclassified**. No verified-settlement transition, independent purchase proof, refund/reversal, migration of existing partner clients, finance reconciliation, consent proof or external contract has been implemented.

## Tests and blocking decisions
`tests/partnerReferralService.spec.ts` adds a fake-Firestore regression for initial pending event, no qualified-counter increase, and duplicate retry. Run `bun run test:partner`, full typecheck, enterprise gates and emulator-based transactional tests; mock-based test cannot establish real Firestore concurrency guarantees.

**Do not merge or deploy** until Product/Security/Legal/Finance approve event and settlement semantics; clients, partner webhook contracts, admin reports and migration plan are reviewed. A separate verified intent, purchase proof and settlement transition must be designed and tested. Manual reconciliation of historical records must not be guessed or automated without proof.

Production and paid partner rewards remain **NO-GO**; see #8, #55, #56 and #57.
