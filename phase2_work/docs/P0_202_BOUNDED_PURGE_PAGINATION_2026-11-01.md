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
