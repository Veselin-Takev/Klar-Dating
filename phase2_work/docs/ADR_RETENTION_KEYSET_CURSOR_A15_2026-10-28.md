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

## Firestore Emulator evidence extension (28 October 2026)

A separate integration suite, `tests/complianceStorageCursorFirestoreEmulator.spec.ts`,
uses the **real Firestore Emulator**, a uniquely named `demo-klar` test database,
a locally bound Express endpoint and an injected **fake GCS delete**. It is
eligible to execute inside the existing `test:ci` emulator environment.

The suite exercises: 100 invalid rows before an eligible 101st, persisted
cursor advancement through equal expiry timestamps, a generation-pinned
deletion and its Firestore audit update, end-of-scan reset, a competing lease
and damaged persisted cursor refusal. It requires an explicit loopback
`FIRESTORE_EMULATOR_HOST` and refuses production project identities. When
the emulator is absent, the suite skips; a successful standalone run outside
emulator is **not** integration evidence.

**Evidence rule:** CI passing must be tied to the exact new commit, and the
actual test execution/skipped counts must be verified. These checks do not
assert live GCS generation behavior, customer data deletion, a live index,
scheduler throughput or independent Privacy/Security/Operations approval.
Production remains **NO-GO**.

## 28 October 2026: positive CI evidence and scope correction

The GitHub Enterprise CI on `159fc307d01334163f770c9e40fbfd1914bba37d`
completed successfully (Actions run `40614339246`). The full job log
confirms **195/195 test files and 1,385/1,385 tests passed**, including
**3 real Firestore Emulator tests** in
`tests/complianceStorageCursorFirestoreEmulator.spec.ts`. Those tests
use fake GCS, not a live Storage generation/replacement race.

**Important architectural finding:** `/api/verification/{verify,status,challenge,submit,decide}`
routes are deliberately retired and return HTTP 410, while actual identity
authorization flows through Didit V3 under `/api/kyc`. The generation
writer in `src/server/klarCore.ts` is a **legacy/manual-path safeguard**;
the active Didit webhook does **not** produce `verification_events` photo
generation records. A-06/A-15 improvements are **not evidence** that Didit
provider-side biometric retention, deletion or transfer controls are approved.
Reconcile actual Didit data location, supplier retention and legal agreements
separately before any release claim. Do not re-enable the retired routes.

**New lease boundary:** `readVerificationPurgeLease` rejects corrupt
timestamp, half-populated token/deadline and invalid token instead of treating
the lock as free. A new real Firestore Emulator negative test proves a
corrupt persisted lease blocks the signed purge. Test results on the new commit
must be verified in CI before recording the extension as PASS.

The daily scheduler processes at most 100 scanned events each invocation,
so throughput, backlog alerting and late-arrival liveness still need load and
Operations/SRE signoff. This PR remains **DRAFT/BLOCKED**, production NO-GO.

## 28 October 2026 – A-06 negative integration scenarios added

The Firestore Emulator suite now also injects a synthetic GCS client that
returns HTTP **404** and **412**. These cases must leave `photoPurged=false`
and must not create an `auditDigest`; they must not starve subsequent due
items, and an end-of-cycle retry may re-encounter unresolved work. Additional
checks ensure both a Firestore `legalHold` and a missing decision-time
`storageGeneration` prevent **any** fake-GCS invocation.

These tests cover real Firestore transactions and the actual signed HTTP
routing, but GCS errors are *injected*, not received from live Cloud Storage.
They do not prove atomic deletion and audit under process termination,
Soft Delete/versioning retention, provider-side Didit photo erasure, or
legally sufficient deletion evidence. Review these controls independently.

**Evidence protocol:** On the newly published commit inspect the GitHub
Actions job log for the Firestore Emulator suite and exact individual-test
PASS counts. Until then this extension is **PENDING**, and the PR stays
Draft/Blocked with Production NO-GO.

## 28 October 2026 – Lease fencing at GCS and audit boundaries

Enterprise CI for `dd8db18b9b0f3f580b227fc7dbaa67b75367a6ae`
(Actions `40645838218`) completed **success**. Its actual job logs
confirm **195 test files, 1,391 tests passed**, including **8/8 live
Firestore Emulator integration tests**. This is source-code/Emulator
evidence for that exact SHA, not for later changes.

Additional candidate hardening: before each GCS delete, re-read the
persisted lease and require a valid token/deadline owned by this worker.
The separate Firestore audit transaction reads both the lease and the
authoritative decision event *inside the same transaction* and rejects
stolen/expired leases, changed decision status or changed retention due
timestamp. New synthetic-GCS/real-Firestore-Emulator tests inject loss
of lease ownership between the fake external delete and audit, mutable
decision state, and an attempted second delete after a lease theft.

**Residual non-atomicity:** a real GCS deletion in flight is not
cancellable via Firestore lease expiry; the GCS delete and Firestore
audit cannot commit atomically. If the deletion succeeds but the audit
is rejected, operator reconciliation is mandatory and missing-object
404 is never treated as successful proof. A 10-minute lease still
requires a production-verified worker deadline and controlled
concurrency. The new tests inject fake Storage; they do not prove live
GCS preconditions or Didit provider deletion.

**Release status:** these changes and their exact-head CI results
are pending; do not mark the latest code PASS until the latest CI
completes. All stacked PRs remain Draft/Blocked and Production NO-GO.

## 28 October 2026 – Signed scheduler completion contract (separate stacked draft)

A separate A-15 scheduler guard treats **HTTP 202 (busy)** as non-success,
as well as error statuses and malformed HTTP-200 responses. Even an HTTP-200
reply for a **full 100-row keyset page** is not a verified completed scan:
the scheduler raises a retryable error and uses the persisted cursor on its
next invocation, rather than silently acknowledging the day as complete.

The parser checks bounded integer counters, result-count consistency and
`ok=true` without logging response bodies that may contain UID/path data.
This does *not* increase guaranteed throughput beyond Cloud Scheduler's
configured retry limits. Sustained backlogs can still exceed 30-day targets;
Ops must measure and alert on backlog and review scheduler cadence. No live
TTL ACTIVE, GCS generation-race, Didit provider-retention or independent
release evidence is implied. Production remains NO-GO.
