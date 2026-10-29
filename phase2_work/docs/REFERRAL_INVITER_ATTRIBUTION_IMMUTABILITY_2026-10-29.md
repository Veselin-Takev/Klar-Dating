# Referral inviter attribution immutability — Issue #48 (2026-10-29)

**Draft. Production NO-GO.** Base main SHA `2808dc1cbb485f70b403681c108cea5a3361d950`.

## Verified finding

The existing `POST /referral/claim` transaction returned `true` whenever the invitee profile already had any truthy `referredBy`. A claim for a different inviter was therefore reported as successful, although attribution was never changed. This is a misleading acceptance boundary in the Member Referral 2.0 flow and can hide attempted reattribution.

## Correction

Inside the same Firestore transaction and after account deletion / inviter-code eligibility checks, the service now returns success for an already-attributed invitee **only if** `referredBy === inviterRef.id`. A different inviter returns the existing HTTP 409 `Einladung für dieses Konto derzeit nicht verfügbar.`. No rewards, KYC status or referral attribution are mutated on mismatch. An exact retry by the original inviter remains successful and write-free. The HTTP regression uses the repository's transaction-oriented Firestore double and checks both responses, preserved inviter identity and zero writes.

## Release boundary

This narrows an identity/attribution claim but does not implement signed single-use referral tokens, verified-person safeguards, fraud controls, rewards, or full Art.17 cleanup. Requires exact-HEAD Enterprise CI; emulator concurrency and independent threat-model reviews remain P0 #48 gates. No direct main commit, merge or deployment. **NO-GO**.

## Adult eligibility gate (2026-10-29)

Enterprise CI run `40837058993` succeeded on the original PR SHA `47f635f28f171a388478e80c388420bb4240008e`. Review of the member-referral claim transaction showed that it checked inviter code, deletion markers and existing attribution, but did **not** require either participant's `isAdult` to be `true`. This allowed attribution between underage and/or unverified-age accounts (without rewards). The claim transaction now fails closed unless both invitee and inviter have explicit `isAdult === true`. Four negative HTTP regression cases cover false and absent age flags on both sides; test fixtures were updated to model valid adult inviters. This is an age-eligibility guard, **not Didit identity verification** and does not grant trusted status, rewards, or production authorization. Actual KYC signature trust, concurrency, abuse prevention and formal privacy approval remain open under #48. New exact-head CI is required. **Production NO-GO.**

## Invitation code issuance adult eligibility — 2026-10-29

Enterprise CI run `40838152391` passed on original PR HEAD `982a1d41475569b107e076d9219081d462060a25`. Further review found `GET /referral` issued and persisted a member invitation code for any existing, non-deleting account, while `POST /referral/claim` already required both invitee and inviter to satisfy `isAdult === true`. The issuance transaction now rejects missing, false, or null adult eligibility before updating the user document or disclosing a share URL. Three HTTP negative fixtures assert 409 and zero code writes; valid adult issuance remains tested by the existing positive case. This is only an explicit profile age eligibility check, **not** validated Didit KYC, and does not constitute independent proof of age. Race tests, referral issuance token rotation, fraud and regulatory review remain release blockers. New exact-HEAD CI and independent approvals required; **Production NO-GO**.

## Malformed legacy attribution remains quarantined — 2026-10-29

Enterprise CI run `40839048912` passed at preceding HEAD `cf3f46419d367d532f9233e5d78b7ad9adbbc78e`. A further data-integrity review identified that `if (userSnap.data()?.referredBy)` was truthiness-based: a profile with an explicitly present but corrupted `referredBy` value (`null`, `''`, `false`, `0`, `{}`, `[]`) was incorrectly treated as never-attributed, allowing an overwrite. The transactional guard now distinguishes an **absent field** (eligible for the original assignment) from **any present value**; only an exact, non-empty string equal to the current inviter is an idempotent retry. Six HTTP negative tests assert 409 and no persisted user/referral-event writes for corrupted legacy fields. No automatic migration/reassignment is attempted. Data remediation needs a separately authorized, audited procedure. New exact-head CI and emulator checks required; no merge or deployment. **PRODUCTION NO-GO.**

## Real Firestore emulator attribution regression — 2026-10-29

Following Enterprise CI PASS `40840184040` on `5e674ae7a4cd654ac04dd468f328cb1f502cde11`, added `tests/referralClaimImmutabilityEmulator.spec.ts`. It runs a genuine HTTP route backed by the real Firestore emulator, writes two eligible inviters plus an invitee, claims the first inviter, then submits a same-inviter retry and a competing different-inviter claim. It expects statuses 200/409, an unchanged `referredBy`, exactly the first inviter's attribution record and no competing attribution. It requires the configured loopback emulator port, rejects production and durable fallback, checks project IDs against `demo-klar`, and deletes all test documents including the UID-specific rate limiter record. It is skipped unless `FIRESTORE_EMULATOR_HOST` is set; a non-emulator unit PASS is **not** emulator evidence. This checks sequential initial attribution followed by concurrent requests, not every first-writer race. Additional fraud, Didit-KYC, token-rotation and privacy controls remain P0; exact-head CI and specialist approval required. **Production NO-GO.**
