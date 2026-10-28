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

## Exact CI evidence and additional non-skippable emulator gate (28 October 2026)

**Earlier accepted execution evidence:** PR #162 commit
`159fc307d01334163f770c9e40fbfd1914bba37d`,
GitHub Actions run `40614339246`, job `122573579648`:
`validate: success`; the archived `Tests` log confirms
`tests/complianceStorageCursorFirestoreEmulator.spec.ts (3 tests)`
ran and passed with **195 test files passed**. This is a real Firestore
Emulator test using synthetic data and a fake GCS deleter, **not** live GCS,
cloud index or independently signed production evidence. Later commits
require new exact-head validation.

This stacked hardening package adds a dedicated, mandatory
`test:retention-emulator` step in root `.github/workflows/ci.yml`,
a separate `scripts/run-retention-emulator.mjs` executable and six
negative preflight cases. The executable refuses absent/non-loopback
Firestore Emulator, unexpected port, non-demo Firebase project, production
runtime and durable database fallback. It then runs **only** the A-15
Firestore integration suite with an explicit emulator-required environment,
rather than accepting a green test command with skipped cases.

The command uses `firebase.pruefung.json`, project `demo-klar` and the
local Java/Node/Firebase toolchain, and never writes production state.
Run from `phase2_work`: `bun run test:retention-emulator`.
CI evidence from this new gate and independent Security/DPO/Legal/Ops
approval are **PENDING** until checks finish on the new commit.

**Still NO-GO:** This test does not establish production Firestore
composite-index availability, immutable real GCS 404/412/race evidence,
complete deletion/reconciliation, 20 ACTIVE staging TTL policies, or release
signatures. No waiver or merge is authorized.

## 28 October 2026 – Mandatory emulator CI gate CLI correction

Exact-head CI on `9483760b98560b53108d4209825f5ca277c432a4`
failed in run `40645451154`, step `Retention Firestore emulator mandatory`.
The Firestore Emulator started, but the runner exited before executing the
suite because pinned Vitest rejected `--minWorkers=1`:
`CACError: Unknown option --minWorkers`. The six fail-closed preflight
negative tests had passed. This was a **test invocation error**, not proof
of failing Firestore retention behavior.

The correction removes only the unsupported CLI switch; `--maxWorkers=1`,
the real Emulator requirement, CI mandatory step and all fail-closed
environment checks remain. A new source regression asserts the flag
cannot be reintroduced. Do **not** mark the gate PASS until the corrected
head is validated in Actions and its logs prove the integration tests
actually ran (rather than skipped). Production remains NO-GO.

## Verification handoff – mandatory emulator CI after CLI correction

The first mandatory gate run `40645451154` is **FAIL** due solely to a
Vitest CLI parser error for `--minWorkers=1`; the six guard preflight cases
completed before this error. The correction commit `a478606e17ee7e3580ba4a7c431381f0c7cb76a6` removes
the unsupported argument and adds a flag-regression test.

This validation note distinguishes the *observed failure* from the *pending
retest*: it does not claim any green CI on the corrected commit. The
independent acceptance criterion is a successful root Enterprise CI run on
the exact corrected (or later reviewed) head with the separately named
`Retention Firestore emulator mandatory` step and console evidence of
executed A-15 Firestore integration tests. A skipped step, stale SHA,
cancelled attempt or successful generic test suite alone is insufficient.

The PR #163 stacked branch is based on PR #162. Its ADR file may
overlap later #162 changes; resolve and review those overlapping documentation
updates before any sequential merge. All four PRs #160, #161, #162 and #163
remain Draft/Blocked and Production NO-GO.
