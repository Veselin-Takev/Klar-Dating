# P0 #48 – Art. 17 referral registry interruption and durable resume

**2026-10-30 — Isolated DRAFT; exact-head CI not yet run. PRODUCTION BLOCKED / NO-GO.**

## Parent evidence and narrower gap
Parent [Draft #225](https://github.com/Veselin-Takev/Klar-Dating/pull/225) source HEAD `24eb91841a6dc35f07821c02eab1fa6b17e9642e` passed [Enterprise CI #41132602463](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/41132602463), job `124327067000`, 1481/1481 tests in 203/203 test files. Raw log explicitly shows the **executed** `deletes 401 owned registry reservations across the 400-document batch boundary` test in `accountErasure.spec.ts (5 tests)`. That proves two batches in an uninterrupted invocation, but not a time-sliced worker retry.

The existing `purgeAccountData` runs inside `runDeletionSlice`, with a 45-second budget. `recordDeletionProgress` occurs after an acknowledged 400-document Firestore deletion batch. On expiry after progress, `checkDeletionSlice` must throw `DeletionTimeSliceComplete`; the durable `account_deletions/{uid}` job stays pending, so a later worker can retry with the same request ID.

## Narrow, deterministic test-only instrumentation
The optional `now` and `onProgress` callbacks in `runDeletionSlice` and an optional fourth **internal-only** `sliceTestClock` argument to `purgeAccountData` are default-no-op for all existing 3-argument production calls. They are never accepted by HTTP APIs or user-controlled headers. The callback runs only *after* acknowledged destructive progress. Runtime behavior without the optional argument remains unchanged.

The new `tests/accountErasure.spec.ts` case requires Firestore + Storage emulators, loopback Firestore hostname, `demo-klar` project and non-production runtime. It writes 401 synthetic owner registry documents, one unrelated reservation, a test profile and a durable deletion-job document. The first real Firestore batch deletes 400 owner documents; the callback expires the synthetic clock **after this acknowledged commit**, and the subsequent `checkDeletionSlice` throws a real `DeletionTimeSliceComplete`. Assertions then require exactly **1** owner record to remain, an untouched foreign record, the profile still present and the deletion job still `pending`. A second `purgeAccountData` with the **same requestId** must delete the remaining document and profile. A third call proves idempotency. Test records are cleaned in a `finally` block.

**Scope honesty:** this proves deterministic time-slice interruption and retry of a real emulator-backed Firestore operation, not a physical Node.js process crash, a network disconnect, lease transfer or a Scheduler restart. It does not measure completion latency. It is a synthetic replay of an acknowledged batch followed by a timed halt.

## Required acceptance
- Exact source-head CI **completed/success** with the job-level TypeScript/Enterprise static gates and full test/build/browser checks.
- Raw log must explicitly show the new `resumes after 400 acknowledged registry deletions and an expired deletion time slice` test **executed and PASS (not skipped)**; `accountErasure.spec.ts` should increase from 5 to 6 tests.
- An explicit assertion must confirm the `DeletionTimeSliceComplete` exception, exactly 1 owned reservation remaining after first pass, durable pending job, remaining deletion on next invocation and foreign-owner preservation.
- Any CI failure, skip or emulator mismatch keeps the new proof **UNVERIFIED**; the parent #225 CI does not transfer.

## Still unresolved
No production member referral endpoint uses the staged atomic registry. The approved legacy-code inventory, transactional unique-only backfill, collision quarantine, claim-time registry check, verified Firebase/Didit/age/consent, actual in-production Art. 17 erasure, scheduler/lease recovery, legal retention and DPO/Legal/Security/SRE/Product/Release Owner signatures remain pending. Related blockers #55/#56/#70/#202/#8 remain OPEN.

**No direct main commits, no merges, no deployment, no manual Actions dispatch, no live Firestore reads, no personal data export, and frozen PR #119/RC R2 unchanged. PRODUCTION BLOCKED / NO-GO.**

## Exact-head CI verification — 2026-10-30
- [Draft PR #226](https://github.com/Veselin-Takev/Klar-Dating/pull/226), immutable source HEAD `b480fdc855d263dd59a6f9da412568be352b5846`, automatic [Enterprise CI #41134045700](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/41134045700) **completed/success**, validate job `124331943342` **completed/success** (0 failed job steps).
- Original CI log explicitly shows `tests/accountErasure.spec.ts (6 tests)` PASS including **`✓ resumes after 400 acknowledged registry deletions and an expired deletion time slice`**, completed in 677 ms. The test **was executed, not skipped**.
- Overall Vitest result: **`203 passed (203)` test files**, **`1482 passed (1482)` tests**.
- This is evidence for real emulator-backed 400-document acknowledged progress, deterministic expired slice, pending durable job and successful same-request retry, not actual OS process termination, lease failover, cloud scheduler, production data or vendor erasure. Parent #225 and initial Art17 #224 remain separate proven checkpoints.
- Until independent data-protection, identity, source inventory/backfill, Security, Operations and Release approvals, **PRODUCTION BLOCKED / NO-GO**.
