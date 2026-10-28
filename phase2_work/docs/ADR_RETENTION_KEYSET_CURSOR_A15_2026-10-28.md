# ADR – Persistent deterministic keyset retention pagination (A-15)

**Status: DRAFT / NOT RELEASE APPROVED.** This branch is stacked on
PR #161 `74b07aa19e9749372a466ca07761e7b15d3d86c9`.
The release manifest remains NO-GO.

## Failure mode addressed
The old query sorted implicitly and repeatedly scanned the first 100
`verification_events` where `fotoLoeschenAb <= now`. If even 100
records were pending, legally held, legacy-without-generation or otherwise
unpurgeable, every later due event could starve forever.

## Design
- A single Firestore document `system/verification_photo_purge_cursor`
  records exact `cursorAt` (Firestore timestamp, nanosecond precision),
  `cursorId` (document identifier), a scoped worker lease, batch size and
  error counters. Corrupt cursor data causes HTTP 503, not a silent restart.
- Every invocation requests up to **100** due events in deterministic
  `fotoLoeschenAb ASC, __name__ ASC` order, starting after the stored
  timestamp+ID keyset. A valid cursor uses both keys; equal timestamps
  cannot starve one another.
- The cursor advances to the final scanned document, **not** the final
  successfully deleted event. Held/invalid data therefore cannot block all
  later events. Invalid records contribute to the persisted failure count;
  errors remain visible as HTTP 503 and are revisited.
- An empty page resets the cursor; the *next invocation* scans from the
  beginning, including newly arrived earlier keys and unresolved records.
  If a process crashes before the checkpoint, the old cursor is preserved
  and retry is idempotent only to the degree the A-06 GCS/Firestore workflow
  already supports it. Do not mark an absent object as purged.
- A 10-minute Firestore transactional lease prevents normal overlapping
  invocation. A worker must own the same token at checkpoint time.
  A 202 busy response performs no work. Expired leases permit recovery,
  but operational request timeouts and race tests are mandatory.

## Operational and legal limitations
- **No live Firestore index/staging evidence** yet. The keyset query may
  require an appropriate composite index or explicit confirmation from
  staging. Verify the query with actual Firestore Emulator and staging.
- The daily scheduler + 100 scanned events per invocation has **bounded
  throughput**. Operations must measure due backlog and enforce a
  retention-latency SLO; do not claim 30-day compliance from pagination
  alone. Increase cadence/throughput only after load and cost approval.
- GCS and Firestore are not atomic. 404/412/retries, holds and cross-system
  fencing/reconciliation remain security and operational review blockers.
- Legal/DPO review is required for legacy/held records and any deletion
  incident process. This code change does **not** authorize bulk deletion.
- CI PASS on exact SHA, GCS generation race tests, index, query and lease
  concurrency in Firestore Emulator, LIVE Staging TTL ACTIVE evidence and
  independent Security/Privacy/Legal/SRE approvals are still required.

## Review checklist
1. Prove 100 unpurgeable events do not starve the 101st.
2. Prove equal-expiry records page uniquely with the document ID.
3. Prove restart after crash replays only the last uncheckpointed page.
4. Prove malformed state and competing leases fail closed.
5. Prove empty page resets and late-arriving older keys are scanned next cycle.
6. Prove no GCS delete occurs from invalid/held/legacy decisions.
7. Prove query index, IAM, actual production deployment composition and
   signed scheduler HTTP semantics in approved Staging.
