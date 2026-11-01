# P0 #202 — Read-only backlog census before any retention queue migration

**Date:** 2026-11-01 · **Branch:** `audit/p0-202-readonly-backlog-census-20261101` · **Base:** stacked [Draft #272](https://github.com/Veselin-Takev/Klar-Dating/pull/272) SHA `61c78d3311dfdba2dec7910f11505d32e2f34479` (exact CI [#41287450907](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/41287450907) SUCCESS).  
**Decision:** **P0 OPEN / Production NO-GO**. No production query, cloud deployment, datastore or biometric-photo mutation performed.

## Objective

The current P0 #202 purge is deliberately **fail-closed** when >300 due events are returned. This is safer than falsely reporting complete, but it cannot fulfill the declared retention policy at scale. Before building a persistent write queue, obtain independent, privacy-safe evidence of the distribution and anomalies in the existing verification collection. This read-only **census is not itself the durable queue** and does not make the destructive purge production-ready.

## Implementation and evidence scope

- `src/server/platform/verificationBacklogCensus.ts` is a pure, asynchronous, bounded reader that accepts an injected deterministic, document-ID-ordered page fetch. It **never** calls Cloud Storage, Firestore update/delete or external services. It does not import Firebase credentials, PII sanitizers or Firebase Admin. It produces only aggregate numeric counts and explicit `complete`/`truncated` flags, never UID, challenge ID, path, original source value, cursor or provider error.
- It inventories **all** events, including rows with missing/invalid `fotoLoeschenAb`, rather than depending on a due-only query. Separate counters describe due markers, future markers, missing expiry, unknown/pending decision, existing `photoPurged` marker, known hold flags, invalid owner/path, and repeated photo paths. **Counters overlap intentionally**, not a partition and not a verified deletion eligibility decision.
- Every full page must return an opaque progress cursor, and repeated IDs, invalid/missing cursor, over-limit responses or invalid input cause an exception rather than a false success. An extra one-item probe detects whether the cap was exceeded. If truncated, `complete=false`; no caller may infer a finished audit.
- `tests/verificationBacklogCensus.spec.ts` covers **1,101** events, missing expiry, holds, ineligible/unknown decision, cross-page duplicate paths, exactly-full boundary, missing progress and replayed IDs. The mandatory `check:retention-census-safety` gate verifies that the CLI rejects production-like projects, public endpoints and all invocations without explicit emulator-only restrictions.
- `scripts/audit-verification-retention-backlog.mjs` is an **operator-invoked, read-only LOCAL FIRESTORE EMULATOR tool only**. It requires `--emulator-only`, a `demo-*` project and a loopback `FIRESTORE_EMULATOR_HOST`. It enumerates `verification_events` by document ID and prints aggregate counts. The script was **not run against any staging or production database**.

## Optional developer-only execution

Only after starting an isolated Firestore emulator with **synthetic** events and confirming that no real Firebase project is in use:

```sh
cd phase2_work
FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 \
GCLOUD_PROJECT=demo-klar \
node --import=tsx scripts/audit-verification-retention-backlog.mjs --emulator-only
```

The command is deliberately rejected if it could reach a remote Firestore endpoint. A complete empty demo emulator census **does not** demonstrate that production data was reconciled.

## Required controls before building/activating a durable work queue

1. Independently read the real Cloud Scheduler, functions revision, IAM and GCS policy metadata under authorized SRE permissions. Do not infer deployed status from unmerged source.
2. Provide a DPO-approved mapping of `verification_events` to authoritative UID/challenge/GCS object generation and decision timestamp, including older records missing expiry or holds.
3. Define an **authoritative eligible work index**, immutable idempotency key and transaction-owned claim state, with lease expiry/recovery and multi-worker ownership; **never** use an arbitrary cursor to skip unprocessed failures.
4. Design bounded cursor advancement with a replayable, monotonic progress receipt and a multi-page (>300) backfill, plus separate quarantine for malformed/held entries and explicit operator escalation.
5. Establish object-generation fencing, legal-hold policy and decision-change protection at the delete boundary. Recovery after GCS delete but failed Firestore audit must not silently count as success; 404 is not inherently a verified receipt.
6. Test staging GCS 404/412/holds and metadata, Firestore transaction/lease races, retries, crashes between delete and audit, duplicate cross-collection paths, and audit log minimization without real biometric test images.
7. Re-run exact merged-source SHA Gates, SCA/SAST and native emulators; obtain signed independent AppSec/DPO/Legal/SRE and Release Owner approval before any cloud change or live purge.

**Census limitations:** Firestore pagination is not an atomic multi-page snapshot under concurrent writes; results are **indicative** even when `complete=true`. Document IDs and storage paths are held only in ephemeral process memory for duplicate checks. Duplicate-path count is scoped to visible scanned events. No external backups, GCS object existence, tenant ownership or global data completeness are checked. Missing/unknown additional hold fields are not evidence of no holds. `complete=true` is enumeration completion for the injected dataset, not security/privacy compliance.

**P0 #202 remains OPEN; overall Klar Production Readiness is BLOCKED / NO-GO.**
