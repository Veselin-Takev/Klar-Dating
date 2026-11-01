# P0 #202 — Write-ahead GCS delete intent and fail-closed crash reconciliation

**Date:** 2026-11-01  
**Branch:** `security/p0-202-write-ahead-delete-intent-20261101`  
**Parent:** unmerged [Draft #274](https://github.com/Veselin-Takev/Klar-Dating/pull/274), exact SHA `0a01784efb56870969f81598e166072500b4f406`, successful [CI #41289646248](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/41289646248). Parent is stacked on #273 → #272 → #271 → #269.  
**Decision:** **P0 #202 OPEN / Production BLOCKED-NO-GO.** Inert source-only reducer; no live worker or deletion enabled.

## Confirmed crash gap in parent

Parent #274 had `leased → receipt_pending` only *after* observing a successful GCS delete. If the worker successfully deletes a generation-fenced GCS object, then crashes before the Firestore `receipt_pending` transition, the stored job remains `leased`. Its lease can expire, allowing `claimPurgeWork` to reassign the job as a fresh physical-delete attempt. That is an **unresolved destructive side-effect ambiguity**, even when the generation precondition prevents deletion of a newer generation. A GCS HTTP 404 is **not proof** that the earlier worker completed the intended deletion.

Official sources: [GCS request generation preconditions](https://docs.cloud.google.com/storage/docs/request-preconditions), [Firestore transaction callback retry and side-effect rules](https://firebase.google.com/docs/firestore/manage-data/transactions).

## Source-only remediation in this Draft

The pure `verificationPurgeWorkState.ts` adds a distinct, **write-ahead** `delete_intent` state with intended GCS generation, prepared time and worker lease epoch:

1. `ready → leased`: exclusive bounded lease in a Firestore transaction.
2. `leased → delete_intent`: **persist intent in a committed transaction before any GCS deletion is attempted**; lease token/epoch must still be valid. The `intent` generation must be exact, positive and immutable.
3. An authorized future worker can *only then* request the GCS deletion of that exact generation with `ifGenerationMatch`, subject to independent current Firestore decision/hold checks. **There is no worker implementation in this Draft.**
4. On a verified, generation-matched GCS success, the same unexpired lease may record `delete_intent → receipt_pending`, bound to the same epoch and generation. Only after an externally authenticated durable audit receipt is the item allowed to become `complete`.
5. **Crash at any point after intent persistence:** an expired `delete_intent` is **not claimable as fresh work**, cannot be released to `ready`, cannot be hidden through ordinary quarantine, and cannot be promoted to `receipt_pending` by a stale worker. The pure `assessDeletionIntentRecovery` accepts read-only metadata observations (`present`, `not_found`, `unknown`) but always returns `action: manual_reconcile`, `physicalDeleteAuthorized: false`. `not_found` is *ambiguous*, a mismatched generation is a replacement, and a matching generation does not automatically license a retry.
6. The unconnected Firestore transactional CAS adapter's allowlist includes the new status but contains no Cloud Storage or live Scheduler integration.

Tests enforce write-ahead requirement, missing/mismatched generation, stale lease fencing, expiry, no rerun of ambiguous delete for 404/412-like metadata, receipt-only recovery and transaction-replay-safe intent persistence. Mutation tests in mandatory `check:purge-work-inert` reject removing the intent and enabling automatic deletion. No identifiers or paths appear in reconciliation output.

## Remaining blockers / what this does NOT prove

- **External write ordering:** A real, reviewed consumer must guarantee the Firestore intent transaction has durably committed **before** invoking GCS. Neither the pure reducer nor the unused CAS adapter can attest this at runtime. An observed GCS HTTP 200 does not automatically produce an immutable forensic receipt.
- **Manual ambiguity may stall deletion forever:** This deliberately fail-closed prototype does not complete a durable queue or fix the >300-row backlog. It requires a privacy-safe, reviewed operator protocol and auditable resolution that distinguishes "not attempted", "attempted but response lost", "deleted" and "replaced".
- **No cross-service atomicity or precisely-once proof:** GCS cannot participate in Firestore transactions. The residual gap between GCS effect and Firestore observation can only be reconciled with independent generation/operation evidence, receipts and explicit authorization. **Never** consider an unauthenticated 404 or replaced generation as deletion success.
- **Real security boundaries:** Missing authoritative tenant/UID/challenge/path/generation linkage, legal holds and retention expiries, duplicate/ineligible legacy rows, interleaving decision changes, staging GCS retention/412/404 behavior, native Firestore Emulator contention, audit ledger integrity, scheduler/IAM/TTL state and official AppSec/DPO/SRE/Release Owner signoffs.
- **Integration:** Parent PR #274 and this child remain Draft; no merge into `main`, deployment, production customer-data query, GCS object mutation, Cloud Scheduler update or compliance GO.

## Required independent approval evidence

- [ ] Exact SHA full CI and native Emulator scenarios including concurrency, worker crash after intent, 404/412 and new object generation, receipt replay.
- [ ] Tested write-ahead transaction/GCS ordering with staging instrumented logs and failure injection, real object generation preconditions, holds and legal decision fences.
- [ ] Durable recovery runbook, append-only receipt provenance and safe manual resolution with two-person audit approval.
- [ ] Release-integration of all stacked security gates and unmerged tenant #254 changes, fresh SCA/SAST, staged rollback/restore drill and independent human signoff.

**Status: P0 #202 remains OPEN; production stays BLOCKED / NO-GO.**
