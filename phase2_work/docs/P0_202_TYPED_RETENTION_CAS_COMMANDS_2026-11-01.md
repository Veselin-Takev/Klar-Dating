# P0 #202 — Typed retention CAS commands, receipt execution denied

**Date:** 2026-11-01  
**Branch:** `security/p0-202-typed-retention-cas-commands-20261101`  
**Parent:** unmerged [Draft PR #277](https://github.com/Veselin-Takev/Klar-Dating/pull/277), exact SHA `4c1e04eef8935753b990a50ef4ca99432414c334`, full [CI #41316005858](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/41316005858) SUCCESS. Its logs confirm **four real Firestore Emulator tests executed and PASS**; no skip.  
**Decision:** **P0 #202 OPEN — Production BLOCKED/NO-GO**. Source-only unconnected prototype.

## Source-backed gap

Parent #277 added strong transition and field invariants, but still **publicly exported a general `transitionPurgeWorkInTransaction(db, ref, transform)`** function. A future caller could supply any callback, potentially claiming that a GCS delete was successful or marking a job complete with only a syntactically valid digest. Structural validity alone is not cryptographically verified GCS provenance, authorized tenant status, or append-only audit evidence.

## Scoped remediation

- The public general-purpose Firestore callback adapter is **replaced**, not exposed alongside a second unsafe API. A reviewed `executePurgeWorkCommand(db, ref, command)` accepts a discriminated `PurgeWorkCommand` union with precisely four **pre-delete/non-finalizing** operations: `claim`, `release_undeleted`, `prepare_delete_intent`, `quarantine`.
- The adapter builds a **pure internal transaction callback**, performs a Firestore read-before-write, uses the immutable-key/version/status/field-level CAS checks from #277, and rejects unknown commands or unknown keys on recognized commands **before** starting a transaction.
- Deliberately **no commands** are offered to record deletion observation, reconcile a GCS deletion, or issue a final audit receipt. Those operations require a separate independently reviewed trusted provenance/append-only receipt verification design and are **not implied by `receiptDigest` formatting**.
- Offline unit tests verify valid claim+transaction-replay, write-ahead intent, safe release and legal-hold quarantine, rejection of forged `complete`/`receipt_pending`, extra lease properties, stale tokens, malformed references, undecided retry after intent, and schema failures. Native Firestore Emulator tests use only a loopback `demo-klar` project and synthetic data to prove competing typed claim transactions, persisted intent across reads, refusal of a forged completion command and injected lease fields.
- Mandatory `check:purge-work-inert` now fails if a freeform public callback resurfaces, the typed dispatcher or unknown-command guard disappears, unreviewed receipt completion is introduced, or the prototype is wired into the active route or Scheduler. Added static mutation self-tests cover these negative cases.

**Security boundary:** This reduces accidental misuse of an **inert** transaction adapter. It does **not** authenticate a future caller, prove a user's identity or tenant membership, authorize legal-hold decisions, create an actual queue, perform GCS deletion or verify final receipts. The delete-intent preparation step must be integrated only after an approved source-of-truth recheck and a reviewed physical-deletion protocol. Raw callbacks must not be reintroduced into production execution.

## Remaining P0 and release gates

1. Exact-head CI: all mandatory static gates, Typecheck, Functions Build, tests and native **four** Firestore Emulator cases, application build/smoke/browser acceptance, plus final merged-SHA security evidence.
2. Authoritative producer and globally unique tenant/UID/challenge/object path+generation/holds mapping, data migration and legacy missing-field quarantine.
3. Independently authenticated GCS operation provenance, generation-conditioned 404/412/hold behavior, crash-after-deletion-before-receipt reconciliation and append-only receipt transaction, with SRE-approved staging test evidence.
4. Scalable durable queue, lease fairness, >300 backlog processing, retries, quarantines, observability, cost bounds, live Cloud Scheduler/IAM/TTL review.
5. Independent AppSec/DPO/Legal/SRE/Release Owner signatures and formally recorded production authorization. None is provided by this branch.

No merge, deployment, production query, Cloud Storage mutation or customer data operation occurred. `RELEASE_MANIFEST.json` stays `NO-GO` and `productionApproved=false`.
