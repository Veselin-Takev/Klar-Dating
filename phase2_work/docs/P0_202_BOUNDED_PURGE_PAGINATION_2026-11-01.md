# P0 #202 — Bounded, ordered due-photo pagination preflight

**Date:** 2026-11-01  
**Branch:** `security/p0-202-bounded-purge-pagination-20261101`, stacked on unmerged Draft [#271](https://github.com/Veselin-Takev/Klar-Dating/pull/271) at exact `d7acb084e0bc3d4b28d1efd317fd442ca7eb93aa`. Parent #271 stacks on #269.  
**Status:** **DRAFT / PRODUCTION NO-GO** — no live Scheduler, GCS, IAM or production Firestore mutation.

## Source-backed finding

The signed `/api/admin/purge-verification-storage` originally selected only `verification_events.where('fotoLoeschenAb', '<=', now).limit(100)`, with no cursor and no `photoPurged` exclusion. Rows remaining due after their photo was purged, and pending/held/malformed rows, could repeatedly occupy the first 100 positions, starving later due photos indefinitely. A daily Scheduler completion of HTTP 200 was not a completeness proof. This issue is separate from the earlier partial-failure HTTP-200 bug in parent #271.

## Contained source change / scope

- A bounded read-only **preflight scan** now orders on `fotoLoeschenAb`, walks Firestore `QueryDocumentSnapshot` cursors with `startAfter(lastDoc)`, and fetches up to **three pages of 100 due events** under a fixed `now`. An additional one-row probe prevents claiming completeness at exactly 300 rows without proof.
- **No photo is deleted before enumeration completeness is established.** If a fourth page exists, the signed endpoint returns HTTP **503** `verification_storage_purge_scan_incomplete` with only the aggregate `scannedCount`. This triggers the caller's failure response, **not** a successful run. Deliberately never drop rows or silently wrap around.
- Once the bounded due-set is shown complete, the existing decision-aware, generation-conditioned deletion and receipt checks from #271 apply, and the sanitized aggregate response remains in force. Every malformed due record or per-object error causes HTTP 503.
- The existing real HTTP test harness now simulates ordered Firestore snapshot cursors. Synthetic scenarios cover 100 already-purged rows ahead of an eligible item (101 records), exactly 300 already-purged rows with a negative sentinel probe, and **301 due rows** where the endpoint must return 503 with **zero GCS metadata reads/deletes or Firestore audit writes**.
- Static `check:compliance-storage-purge` now checks ordered scanning, cursor stepping, bounded preflight and scan-exhaustion denial. Exact-head CI required.

## Explicit limits and unclosed requirements

**This is a fail-closed interim safety boundary, not a scalable production-retention solution.** If there are more than 300 due events, it deliberately refuses *all* physical purging; hence it cannot meet a 30-day retention SLO at scale. A durable, independently reviewed continuation strategy is mandatory before approving production retention: server-authoritative eligibility index/queue and backfill for legacy missing fields, idempotent cursor/claim leases, bounded worker time/cost, no starvation under permanent ineligible rows, recovery from crashes, concurrent reviewers, more than 300 mixed records, Firestore cursor ordering and required indexes. Do not use unlimited pagination, offset-based scans or skip/checkpoint over errors to cosmetically clear this gate.

Additionally unresolved: cross-system Firestore→GCS decision TOCTOU, legal holds, GCS 404/412 and generation verification in an approved staging bucket, failed-receipt reconciliation, deployed Scheduler state, DPO/Legal/AppSec/SRE approvals and reconciliation with older #231/#233/#242/#250/#252 changes. No claim of production compliance or official GO.

**P0 #202 stays OPEN. Production: BLOCKED / NO-GO.**

## 2026-11-01 — Preflight data-integrity and shared-path hardening

A second P0 source issue was identified while reviewing the initial bounded cursor implementation: `dueDocs.flatMap(...)` silently excluded malformed due rows and recorded `malformedCount` **after** calling `executeVerificationRetentionBatch`. A valid earlier row could therefore be physically deleted before the endpoint returned HTTP 503 for a later malformed row. Also, two due `verification_events` could refer to the same GCS object path, creating ambiguous ownership/receipts.

The follow-up requires the complete bounded read-only scan to pass **all** preflight checks before obtaining a Storage bucket or deleting a photo: every due event must map to one structurally valid candidate, every not-yet-purged candidate must satisfy the authoritative snapshot decision/ownership/expiry/known hold checks, and no two scanned events may share `storagePath` even if one is already marked purged. If any check fails, the route returns aggregate-only HTTP 503 `verification_storage_purge_preflight_failed` with counts and **zero** object deletions/receipts. Synthetic signed Express HTTP tests cover a malformed second row after a valid first row, two records sharing a Storage path, due pending decisions, inconsistent decision fields, in addition to prior 101/300/301-page regressions. The mandatory source guard now asserts these mechanisms remain.

**Known limits:** Only the scanned due cohort is deduplicated: a not-yet-due/missing-expiry event could still reference the same object. A globally authoritative one-to-one UID/challenge/object ownership model, durable eligible-work queue, lineage checks across all active events, transaction-owned decision lease, bounded backfill, staging GCS generations/404/412 and signed DPO/SRE/AppSec approval remain necessary. Updating this draft makes previous CI evidence stale; validate the **new exact SHA** independently. P0 #202 OPEN, Production NO-GO.
