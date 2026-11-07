# VES-5 — CI sentinel fail-closed hardening (2026-11-07)

Status: **P0 OPEN / NO-GO**. `productionApproved=false`.

## Specific defect
The transaction-backed Firestore fence test preflight in `tests/verificationPurgeFirestoreFence.spec.ts` previously enforced its emulator when CI or GITHUB_ACTIONS equaled the exact string `true`. A CI provider exporting `CI=1`, `GITHUB_ACTIONS=1`, or a noncanonical non-empty enabled sentinel could skip all emulator transaction cases when the emulator host was missing. This is a test-coverage gap, **not** a proof that a production GCS deletion is safe.

## Scoped fix
- Treat any trimmed, nonempty `CI` or `GITHUB_ACTIONS` value other than explicit `false` or `0` (case-insensitive) as CI requiring the emulator.
- Keep dedicated `KLAR_REQUIRE_FIRESTORE_EMULATOR=1` and the existing emulator-target/project checks intact.
- Add test coverage for numeric/alternative enabled sentinels, explicitly disabled local sentinels, and independent source mutations removing either mandatory CI guard.
- Keep the preflight extract executable in the `node:vm` dependency-free regression harness (no TypeScript syntax in the extracted guard).
- No changes to Firebase rules, Cloud Storage, production permissions, release flags, app routes, backend deletion or consent behavior.

## Verification boundary
Source and test contract reviewed for the modified branch; **full Node test suite, pinned Node v22.23.3, exact-head CI, and actual emulator transactions are NOT yet independently verified by this document**. Do not mark tests green without CI run evidence. Intended validation:

```sh
cd phase2_work
node --test scripts/verification-fence-emulator-preflight.test.mjs
npm run check:retention-p0
npm run release:verify
```

Keep `VERIFICATION_PHOTO_PURGE_P0_LIVE_RELEASE_APPROVED=false` and `productionApproved=false`.

## Remaining release blockers
1. VES-5: independent real-writer cross-service Firestore/GCS race proof after last Firestore authorization, hold/IAM integration, full writer inventory and crash recovery, signed off by AppSec/DPO/SRE/Release Owner.
2. VES-11: independently approved backend origin and authenticated age-gate preview E2E with Firebase/App Check/Rules/IAM evidence.
3. VES-8: read-only cloud identity/TTL/Scheduler/live retention proof and staging rollback evidence.
4. Final release: CI on an exact final consolidated SHA and signed immutable release evidence.

Related: [#339](https://github.com/Veselin-Takev/Klar-Dating/pull/339) validated its own earlier exact SHA `30f3d83e2b6bce7b5ff62d88ec04c5fc3c7a2795`. That result **does not apply** to this changed branch. [#341](https://github.com/Veselin-Takev/Klar-Dating/pull/341) holds the independent release-gate register.
