# P0 #202 — Verification-event source inventory gate (2026-11-03)

**Status:** Review candidate on PR #203. **Production BLOCKED / NO-GO.** This is static regression prevention, not an approved or deployed cross-service deletion protocol.

## Scoped inventory on the feature branch

The scanner covers production files in `phase2_work/server.ts`, `phase2_work/src/server/**` and `phase2_work/functions/src/**`. Test and specification files are excluded.

| Literal access | Count | Role and authority boundary |
| --- | ---: | --- |
| `src/server/klarCore.ts` | 1 | Moderation transaction **creates** the decision record (`entscheidung`, `decidedAt`, `storagePath`, `fotoLoeschenAb`) |
| `src/server/datenschutz.ts` | 1 | DSGVO data-subject export **reads** the collection |
| `src/server/trustAndSafety.ts` | 1 | Art. 17 account-deletion flow deletes matching verification-event records after a bounded storage cleanup stage |
| `src/server/routes/complianceStorage.ts` | 3 | Decision-aware purge query plus transactional intent/proof updates |

These are reviewed **literal references** in these server/Functions sources, not a claim that all runtime access is covered. Dynamic collection names, other processes, Firebase Console, external Admin SDK jobs, other project directories and cloud IAM operations are outside the static scanner.

## Enforced fail-closed review gate

- `scripts/check-verification-event-writers.mjs` traverses server/Functions source files and fails if the number of literal references changes or a new source file references `verification_events` without a reviewed policy entry.
- Each approved file retains a representative operation signature to detect accidental removal of its reviewed access mode.
- `scripts/test-verification-event-writers.mjs` includes mutation regressions: new writer, extra reference, removed creation signature and missing authorized source.
- Both run through `check:retention-p0`, which is already a constituent of `check:enterprise`.
- The gate must be rerun on the **exact final commit**. A source-only green result is not a Firestore/Storage emulator test, penetration test or evidence of deployed configuration.

## P0 cross-service risk remains open

`deleteVerificationStorageFile` performs a Firestore authorization recheck **before** a generation-conditional GCS delete. The existing adversarial test demonstrates a decision revocation after that recheck which still permits deletion in the mock. GCS generation CAS does **not** protect against a concurrent change in Firestore decision or legal-hold state for an unchanged object generation.

Before enabling production purges, AppSec, DPO/Legal and SRE must approve a common transactional state machine and distributed fencing/compensation contract for **all** mutation paths, including account deletion. Demonstrate a negative race test which prevents unsafe deletion, as well as crash, stale lease, object hold, 404/412, audit receipt and retention/Art.-17 compatibility cases in emulator and staging.

**No change to `main`, Cloud Scheduler, GCS objects, production credentials or live data is authorized by this documentation. `productionApproved=false`.**
