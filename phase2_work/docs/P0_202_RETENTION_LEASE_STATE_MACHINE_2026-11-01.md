# P0 #202 — Non-deployed retention work lease and receipt state machine

**Audit date:** 2026-11-01 · **Branch:** `security/p0-202-retention-lease-state-machine-20261101` based on the unmerged [Draft #273](https://github.com/Veselin-Takev/Klar-Dating/pull/273), exact parent SHA `5223b4c796c46c126a1f7ebfc5bebf931ffa991a` (full [CI #41288386062](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/41288386062) SUCCESS).  
**Security state:** P0 #202 **OPEN**, **Production NO-GO**. No live worker, scheduled function, Cloud Storage delete, Firestore writes, or deployment was enabled by this branch.

## Why this architectural boundary is necessary

Prior source mitigation [#269](https://github.com/Veselin-Takev/Klar-Dating/pull/269)–[#272](https://github.com/Veselin-Takev/Klar-Dating/pull/272) prevents upload-age-only deletion, requires authoritative decision and generation fencing, denies falsely successful partial purges and stops at more than 300 due records. The subsequent read-only [#273](https://github.com/Veselin-Takev/Klar-Dating/pull/273) models an aggregate backlog inventory. None is a durable, safely resumable **processing queue**.

The next processing architecture must distinguish **a leased deletion attempt** from **a physical delete already observed but whose audit receipt is still pending**. Simply releasing or reacquiring an expired lease and retrying GCS deletion can be wrong after a network disconnect or failed Firestore audit commit.

References: [Firestore transaction isolation and automatic retries](https://firebase.google.com/docs/firestore/transaction-data-contention), [Firestore transaction rules: read before write, callback can replay](https://firebase.google.com/docs/firestore/manage-data/transactions), [GCS object generation fencing](https://cloud.google.com/storage/docs/request-preconditions).

## Implemented in this isolated, unconnected prototype

The pure `src/server/platform/verificationPurgeWorkState.ts` defines a versioned queue record with an **opaque** server-issued key, finite lease epoch and token, attempt/revision counters, bounded lease window, generation observation marker and SHA-256-format receipt digest. Supported states:

| State | Purpose | Valid transition |
|---|---|---|
| `ready` | Eligible candidate **not yet processed** (eligibility itself must be validated externally) | claim unique lease, quarantine |
| `leased` | One caller has bounded lease; must independently recheck UID/tenant/path/decision/hold | release with future backoff **only before deletion**, record observed delete, quarantine |
| `receipt_pending` | GCS delete has allegedly succeeded, authoritative receipt not finished | claim **receipt-only reconciliation** after expired lease; complete only with durable digest |
| `complete` | Independently checked audit receipt completed | **terminal**, no re-claim or delete |
| `quarantined` | Invalid, ambiguous, held or operator-reviewed record | **terminal for this prototype**, requires explicit independently approved manual procedure |

The counters and rotating lease token+epoch prevent an old worker from completing the new worker's task. A `receipt_pending` record cannot return to `ready` or be claimed for physical deletion. No GCS calls, network calls or queue producer exist in the reducer.

`src/server/platform/verificationPurgeWorkFirestore.ts` provides an **unused, opt-in** Firestore transactional compare-and-swap adapter for an exact `verification_purge_jobs/{opaque-id}` document. It does a single transaction read, applies a pure transformation and checks that immutable identity is unchanged and revision increments once before `tx.update`. Transactions may transparently retry, and **all external IO must occur outside** their callback. It does not create jobs or invoke deletion. Source guard `scripts/check-purge-work-inert.mjs` fails CI if either module becomes directly bound to the deployed route or Scheduler, if GCS calls appear in this prototype, or if the transaction guard is removed. Mutation tests are mandatory under `check:purge-work-inert` in `check:enterprise`.

Tests `verificationPurgeWorkState.spec.ts` and `verificationPurgeWorkFirestore.spec.ts` cover stale/expired leases, ABA-token epochs, too-short/long leases, replay/contended callbacks, missing and forged Firestore documents, quarantines, invalid generations, receipt-only recovery and terminal idempotence. The tests are synthetic in-memory/unit evidence; they do not simulate the full Firestore Emulator transaction isolation, GCS latency or actual production data.

## Critical unsolved design and implementation gaps

1. **Authoritative job producer and immutable linkage**: approved UID/challenge/tenant and exact GCS object generation, consent, legal holds and `fotoLoeschenAb` must be mapped to one queue document. Duplicate/legacy missing-field records must be quarantined; key must be a keyed HMAC or comparable opaque server-issued identifier with securely managed secrets, not a raw UID or path.
2. **Cross-service atomicity cannot be guaranteed by Firestore transactions alone**: a crash can occur after GCS delete but **before** persisting `receipt_pending`. This prototype explicitly does **not** prove exactly-once physical deletion, nor that its `observed` marker is truly backed by a GCS receipt. A reviewer-approved outbox/operation-id/provenance and a GCS-generation-specific 404/412 reconciliation protocol are mandatory.
3. **Verified receipt before `complete`**: `completePurgeReceipt` is a pure state transition. It must only be called after independent, durable append-only audit evidence. The prototype only validates digest format, not external proof.
4. **Multi-worker concurrency**: The adapter demonstrates a transactional read/update shape but has not been verified under real emulator contention, network retries, lease expiry, ABA claims, fairness, crashing workers, throughput, ordering indexes and more than 300 events. Transaction callbacks must be pure; no GCS request within them.
5. **Storage generation/legal holds**: enforce object generation, Firestore decision-change fencing, storage retention policy and two-person hold/migration approvals at the real destructive boundary; test 404/412 and concurrent object replacement in an authorized staging bucket.
6. **Release / integration**: all new prototypes are unmerged and unused. Parent #273 is also stacked on #272 → #271 → #269; code and mandatory `check:enterprise` gates from independent Draft #268 must be reconciled by code owners before any merge. No out-of-band Cloud Scheduler, TTL, IAM, Storage Rule or customer-data action is permitted.
7. **SRE/Privacy/Legal/AppSec acceptance**: operator trace and metrics without UID/path, live deployed revision inventory, durable alert/runbook, staging restore/rollback, RoPA and Art. 5/9/17/25/32 legal review, independent signed GO remain entirely outstanding.

## Decision gates

- [ ] New exact-head CI complete and all P0 lease/receipt and isolation regression tests green
- [ ] Native Firestore Emulator CAS contention/lease expiry/timeout/crash simulations
- [ ] Proven source-authoritative, globally unique path/generation and hold index and secure idempotency keys
- [ ] Durable GCS-delete-audit reconciliation design with verified 404/412 and nonreplayable receipts
- [ ] Measured >300-record backlog throughput/replay, aging, quarantine, failover and on-call alerts
- [ ] Independent AppSec/DPO/Legal/SRE/Release Owner authorizations; real stage-to-production artifact and IAM checks

**No GO. `RELEASE_MANIFEST.json` must remain `productionApproved=false`.**
