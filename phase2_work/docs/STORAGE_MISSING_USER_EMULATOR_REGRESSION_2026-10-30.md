# Storage Rules missing-user emulator regression — 2026-10-30

## Scope
Stacked on draft PR #209, which itself builds on #208 -> #207 -> #205 -> #203. The real Firebase Storage Rules emulator test file `tests/storageRules.spec.ts` now includes a focused test for **absent Firestore requester and target owner documents**. Test uses known absent fixtures `unknownUid` and `${prefix}-absent-owner` and checks:
- unknown authenticated requester cannot read an existing adult owner's image;
- verified adult requester cannot read the missing owner's image;
- missing owner cannot read, upload or delete in own prefix;
- a known active adult reader can still read an active owner's image (positive control).
The Storage objects used to exercise read/delete denials are created and removed with the Admin SDK in `try/finally`.

## Evidence / status
**UNVERIFIED NEW TEST — PRODUCTION NO-GO.** This document records source changes only; no local test execution is claimed. Before any promotion require exact-head automated CI, explicit confirmation that `tests/storageRules.spec.ts` ran **not skipped** under both Firestore and Storage emulators, and review that missing document denies without `Null value error` warnings. Prior green #209 run #41018751334 does not cover this new commit.

## Release gates
Actual staging Rules/IAM/CORS; legacy bearer download URL revocation (#206); legal-hold and deletion behavior (#202/#70); Security/DPO/SRE review; final integrated SHA approval and issue #8 all remain blocked. No merge, deployment, or customer data touched. Respect GitHub Actions minutes and avoid manually triggering additional workflows.
