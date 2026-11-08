# VES-5 — Firestore verification-photo record hold precondition

**2026-11-08 · Dependent Draft · P0 OPEN · Release NO-GO**

## Audit finding and narrow mitigation

The signed, decision-aware purge route on the [parent security branch #345](https://github.com/Veselin-Takev/Klar-Dating/pull/345) checked Storage object's `temporaryHold` and `eventBasedHold`, decision status, due date, generation, lease and intent. But it did **not explicitly check a preservation/legal-hold field carried on the Firestore `verification_events/{challengeId}` record**. A record marked for preservation could therefore satisfy these existing predicates.

This stacked review patch introduces an explicit, conservative record-level field contract:
- `photoPurgeHold`: boolean, normally absent on legacy records; `true` blocks deletion.
- `legalHold`: boolean, normally absent on legacy records; `true` blocks deletion.
- For either field, a present value other than the literal boolean `false` (including `null`, strings, numbers and objects) **fails closed** as an invalid/held record. An absent value preserves legacy behavior; it does *not* prove that there is no other legal hold outside this document.
- The check executes inside the existing `assertStillEligibleForPurge` precondition, reused by initial intent creation, 404 reconciliation, final pre-delete Firestore transaction and audit transaction.
- Unit tests cover no hold, explicit release, active hold and malformed values; signed HTTP tests on the actual Firestore Emulator check four active/malformed *initial-record* combinations: 503 response, no Storage delete, no `photoPurgeIntent`, no `photoPurgeProof`, `photoPurged=false`. Additional adversarial emulator cases insert each hold field **after the durable purge intent but before the final Firestore authorization**; they require 503, zero physical deletion and no audit proof, while the existing intent remains for reconciliation.
- The existing `check:compliance-storage-purge` enterprise gate now guards the hold-check function's presence.
- A further read-only review found that Storage `getMetadata()` was treated as unheld unless `temporaryHold === true` or `eventBasedHold === true`. If the metadata were malformed (for example a string `"true"`, a string `"false"`, a number, `null` or an object), the earlier `=== true` check could treat it as an unheld object. The inspection now accepts **only an absent hold property or literal boolean `false`**; any other present value fails closed before GCS deletion. This is a defense against unexpected/malformed service responses, **not a demonstrated real GCS API encoding defect**. The review change is covered by six additional negative unit cases and two mandatory `check:compliance-storage-purge` static rules. It does not close the Firestore/GCS cross-service race.

## Limits — never interpret this as a VES-5 P0 fix

**CRITICAL, UNRESOLVED:** This is a *record-state precondition*, not cross-service fencing. A hold written **after** the last Firestore transaction and **before** GCS `file.delete({ifGenerationMatch})` can still race with deletion without changing the GCS object generation. The successful older race-characterization unit test deliberately demonstrates this. The new field is not an authoritative operational legal-hold process until all moderators, account-deletion workers, external Admin SDK clients, scheduled jobs and GCS writers are inventory-verified, transition-fenced and tested.

A valid P0 closure still requires:
1. Independent all-writer inventory, including dynamically constructed paths and out-of-repository/GCP console writers.
2. Review-approved monotonic fencing / purge state-machine protocol that makes an in-flight destruction incompatible with a decision revocation or legal-hold placement; a simple second read is **insufficient**.
3. Adversarial exact-SHA test proving that a revocation/hold **after** the last Firestore authorization but **before** GCS delete does **not** result in unauthorized deletion; emulator AND controlled GCP staging for GCS generation/hold semantics.
4. Crash/replay and 404/412 proof, legal retention balancing under DSGVO Art.17, bucket ownership, IAM, scheduler, Firestore rules, and AppSec/DPO/SRE/Release Owner signoffs.
5. Reconciliation with Firebase Admin SDK project binding in [Draft #343](https://github.com/Veselin-Takev/Klar-Dating/pull/343), [#344](https://github.com/Veselin-Takev/Klar-Dating/pull/344) and Storage bucket selection [#345](https://github.com/Veselin-Takev/Klar-Dating/pull/345).

**No source integration/merge into `main`, production flag activation, GCS deletion, IAM/billing change or Cloud resource provision is authorized.** Leave `KLAR_VERIFICATION_PHOTO_PURGE_ENABLED` unset/false and `productionApproved=false`.

## Deterministic verification

```bash
cd phase2_work
npx vitest run tests/complianceStoragePurge.spec.ts
npm run check:compliance-storage-purge
# Set up the reviewed *local* demo-klar Firestore Emulator profile only:
# FIRESTORE_EMULATOR_HOST=127.0.0.1:<reviewed-port> npx vitest run tests/verificationPurgeHttpEmulator.spec.ts
npm run check:retention-p0
npm run release:verify
```

Record the exact HEAD SHA and CI workflow verdict only after the run completes. A CI PASS does **not** prove a safe post-auth hold race.

Links: [VES-5](https://linear.app/takev/issue/VES-5), [VES-12](https://linear.app/takev/issue/VES-12), [#317](https://github.com/Veselin-Takev/Klar-Dating/pull/317).
