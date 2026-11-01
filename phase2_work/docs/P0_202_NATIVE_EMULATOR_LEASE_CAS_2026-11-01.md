# P0 #202 — Native Firestore Emulator lease concurrency and CAS hardening

**Date:** 2026-11-01 · **Base:** unmerged [Draft #275](https://github.com/Veselin-Takev/Klar-Dating/pull/275) exact commit `7b30adf79e8020101b081ec80e5f4edb0e7d0460`, [CI #41290477469](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/41290477469) completed SUCCESS.  
**Decision:** **P0 OPEN / Production BLOCKED-NO-GO.** This PR does not connect a queue producer/consumer, write a live receipt, delete GCS photos, or deploy any cloud workload.

## Evidence gap and correction

Existing `verificationPurgeWorkFirestore.spec.ts` tests only **in-memory simulated** transaction callbacks. A simulated replay proves pure state functions and basic assertions but not real Firestore transaction isolation, conflict retries, durable post-restart state, a properly shaped Firebase Admin document reference or any real lock contention.

The opt-in `verificationPurgeWorkFirestore.ts` adapter also previously accepted *any* caller-supplied transform returning the same key and `revision+1`, so a forged callback could jump from `ready` straight to `complete` with an arbitrary digest, or change the GCS generation in an existing write-ahead `delete_intent`. No live worker currently calls this adapter; nevertheless, these are source-level safety flaws in the proposed future queue boundary.

## Scoped changes

1. **Second-line transaction transition validation:** `ready` can become only `leased` or `quarantined`; `leased` can be claimed/released, write a `delete_intent`, or quarantined; `delete_intent` can advance only to `receipt_pending`, and `receipt_pending` only to further receipt reconciliation or `complete`. Completed/quarantined jobs cannot transition. Once an intent exists, its **exact generation, preparation timestamp and lease epoch cannot be changed or removed** by an adapter callback. A receipt-pending state must contain matching intent and observation generations; completion requires a receipt-formatted digest and timestamp. The adapter still cannot independently verify the *authenticity* of a receipt.
2. **Native emulator test** `tests/verificationPurgeWorkFirestore.emulator.spec.ts`: runs only when `FIRESTORE_EMULATOR_HOST` resolves to a loopback host and the configured project is `demo-klar` or unset. Initializes Firebase Admin explicitly on **synthetic** project `demo-klar`; creates random 32-hex synthetic IDs in `verification_purge_jobs`, then deletes only those synthetic test documents. Tests **concurrent real Firestore Admin transactions** claiming one lease (exactly one succeeds), a committed `delete_intent` surviving a fresh read with a later worker rejected despite an expired lease, and a forged ready-to-complete transaction rejected. No Cloud Storage/production API calls.
3. **Offline Vitest regression cases** verify a forged ready-to-complete receipt, fabricated receipt pending without an intent, changed generation and attempt to return to `ready`, and a valid intent-to-observation transition.
4. **Mandatory static/mutation gate** `check:purge-work-inert` now also verifies the adapter-side allowlist and fenced-transition checks cannot silently be removed, and still forbids any live route or Scheduler coupling to the prototype. The existing CI `test:ci` runs Vitest under Auth/Firestore/Storage emulators; the new native test is skipped in local non-emulator Vitest and executed during the full emulator-backed CI. **Check the actual latest CI test evidence**, not just a scoped documentation workflow green.

## Important limitations

- These tests show Firestore Emulator behavior on the exact tested commit, **not** proof of production Firestore transaction semantics under large multi-region contention.
- An adapter still cannot bind an external GCS delete atomically to a Firestore transaction. A crash after write-ahead intent, successful physical delete and before durable observation is still ambiguous, and the current pure recovery policy **always refuses automatic delete retry**. A separate authentic operation receipt, hold and generation evidence is needed for authorized manual reconciliation.
- No queue producer, tenant/UID/path authority, immutable GCS generation and legal hold index, scheduler deployment, real job lease executor, GCS 404/412/retention staging results, >300 backlog throughput, false-negative security testing or independent AppSec/DPO/Legal/SRE/Release Owner signoff exists.
- No realistic image or customer biometric data was used. The test collection is ephemeral and restricted to a demo-* Firestore Emulator; **no production queries, writes, Cloud Scheduler or GCS deletion occurred**.
- All upstream Drafts #269–#275 and independent #268 tenant inventory must be reconciled and approved before any production integration. Never overwrite mandatory `check:enterprise` gates.
- Any new source commits require fresh exact-HEAD full CI. Do not claim Production GO on this evidence alone.

**P0 #202 OPEN. `productionApproved=false`. Production BLOCKED/NO-GO.**
