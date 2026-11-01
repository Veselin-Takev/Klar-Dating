# P0 #202 — Generation-integrity for persisted GCS receipt observations

**Datum:** 2026-11-01 · **Change:** purely inert Firestore retention state model; **productionBlocked / NO-GO**.  
**Parent:** [Draft #298](https://github.com/Veselin-Takev/Klar-Dating/pull/298), exact SHA `a426ca2174ee071ce591342555b3ffb8ec682c74` ([CI #41359081792](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/41359081792) full SUCCESS, 1,497 Vitest/26 Browser).

## Source-derived finding

The P0 #202 pre-delete State/Firestore model already rejected invalid GCS generations on **new write-ahead intents** and read-only recovery after #298. But `markDeletionObserved` still matched `generation === state.intent.generation` without independently checking the string's canonical uint64 validity. A **synthetically corrupted persisted intent** holding an out-of-range generation could therefore pass that equality comparison. Similarly, the pure receipt reconciliation and completion paths checked whether `state.observed` existed without checking a canonical matching intent/observation pair. The adapter's receipt transitions also depended on matching fields, not necessarily their validity. No deployed worker or actual customer/cloud data exposure is inferred; this is a forward-compatibility hardening of an **inert prototype**.

## Implemented fail-closed changes

- `hasCanonicalGcsReceiptEvidence(state)` requires a persisted intent **and** observed generation, with both positive canonical unsigned 64-bit strings and an exact match. It is an integrity predicate, **not proof** of a real GCS request, legal clearance or receipt authenticity.
- `markDeletionObserved` rejects malformed persisted intent or malformed incoming observed generation **even if their strings match**. Its lease/epoch and monotonic timestamp checks remain in place.
- `claimReceiptReconciliation` and `completePurgeReceipt` reject malformed or mismatching stored generations. The Firestore CAS adapter requires the same predicate for `delete_intent → receipt_pending`, receipt renewal and `receipt_pending → complete`, without enabling any of these transitions as public commands.
- Pure negative tests inject out-of-range, zero-padded and very long strings into previously valid state objects and verify fail-closed outcome. The existing 10 native Firestore retention tests and no-Emulator negative CI still execute. Existing `check:purge-work-inert` source and mutation tests were extended to require the receipt predicate in all guarded transitions. No GCS SDK import, IAM, Firebase Rules, Scheduler, Cloud job, real user data or production deployment change.

## Required validation

The new **exact integration HEAD** must pass complete Enterprise CI, with pure receipt tests, source/mutation guards, 5 native Storage + 6 Tenant Firestore + 10 Retention Firestore tests, missing Emulator negative, 18 Didit tests, ReleaseOwner and six P0 schema gates, P95 SLO parity, Typecheck, Builds, 26 Browser Acceptance, Production Smoke. Green #298 CI is SHA-scoped and cannot be copied to this new head.

## Outstanding legally binding production requirements

- Actual authorised deletion for P0 #202 requires a signed moderation/decision and Legal-Hold recheck, generation-fenced GCS operations, 404/412/timeout/crash reconciliation, durable append-only receipts, >300 due-item replay, reviewed Scheduler/IAM, independent DPO/AppSec/SRE approval. None is proven by these helper functions.
- P0 #254 still requires end-to-end Tenant isolation for Firestore, Firebase Storage and Admin SDK; Art.17 legacy migration and reversible cutover; Product/DPO/Legal approved guest/adult/profile-media visibility and token revocation.
- Actual release signoffs by Security/DPO/Legal/SRE/Release Owner for the final hash are still missing.

**`productionApproved=false`. Production BLOCKED / NO-GO. No merge, `main` commit, Cloud operation or client-data mutation.**
