# P0 #202 — Lease/receipt field integrity inside the Firestore CAS adapter

**Date:** 2026-11-01 · **Branch:** `security/p0-202-cas-lease-field-integrity-20261101`  
**Parent:** Draft [#276](https://github.com/Veselin-Takev/Klar-Dating/pull/276), exact head `a8c2830ae325ddf49d07e22508f235898df70204`, [CI #41291380045](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/41291380045) completed **SUCCESS**. In its CI logs, the native Firestore Emulator suite `tests/verificationPurgeWorkFirestore.emulator.spec.ts` actually ran **3 tests / PASS**; it was **not** skipped.  
**Decision:** **P0 #202 OPEN / PRODUCTION BLOCKED-NO-GO**. This is still an **inert** prototype; no production worker or Cloud Storage connection was enabled.

## Confirmed source boundary

The adapter in #276 disallowed invalid *status edges* and enforced an immutable GCS intent generation, but it accepted some crafted callback results with nominally valid edges yet altered security-relevant fields. Examples: `ready → leased` without incrementing `attempt`, `leased → delete_intent` with a forged worker token, and `receipt_pending → complete` with a changed lease token or implausible completion timestamp. A caller-supplied transform is not a trustworthy authorization boundary by itself.

## Isolated correction

`verificationPurgeWorkFirestore.ts` now enforces **field-level invariants** in addition to legal transitions:

- An actual lease claim increments attempt and epoch, uses an opaque bounded-shape token, preserves the prior availability marker and supplies a valid future expiration.
- An undeleted release preserves lease identity and attempt, advances the retry marker, and cannot carry an existing write-ahead intent.
- An intent write preserves the active worker lease, attempt and availability; its GCS generation, lease epoch and preparation timestamp must be consistent with the committed lease.
- Transition to `receipt_pending` preserves token/lease, records the same intended generation and a plausible observation time within the lease. Receipt-only reconciliation may update the worker lease epoch but cannot replace an observed deletion.
- Completion preserves the lease, intended generation and observation, requires a SHA-256-format digest and a completion timestamp after observation but before expiry. **Digest format does not prove authenticity**; the future independently authorized worker still needs an append-only audit/receipt verification.
- Terminal and quarantined states cannot be silently revived; known quarantine reasons are explicit.
- Mutation tests in the mandatory `check:purge-work-inert` gate detect removal of lease/observation/attempt checks. Unit tests cover forged claims/intent/receipt and positive canonical release/hold/reconciliation/complete paths. A **fourth native Firestore Emulator test** rejects a forged lease with no attempt increment.

## Limitations and remaining release blockers

**Not sufficient for deployment:** The opt-in adapter still accepts an arbitrary callback. Status/field validation is a defence-in-depth control, **not** source authorization, secret verification, multi-tenant isolation, immutable signed receipt or a proof that the external GCS call respected object generations and legal holds. A production implementation should use a narrow, typed set of reviewed commands and server-side source authorization rather than arbitrary transforms.

No durable producer/consumer; no approved tenant/UID/challenge/image uniqueness map, legal-hold and expiration reconciliation, distributed worker runtime, true GCS/Firestore atomic transaction, safe resolution of unknown 404/412, on-call runbook, >300 workload, actual deployed Scheduler inspection, staged GCS fault injection, independent DPO/AppSec/SRE/Legal approval or Production GO. All stacked PRs #269–#276 remain Draft; no code in this branch is connected to live deletion. No production data, GCS object, TTL, IAM or Scheduler mutation took place.

**Review rule:** Require exact-head full CI including verified execution of all **four** native Firestore Emulator test cases, Typecheck, SAST/SCA and enterprise security gates. Do **not** infer a new HEAD PASS from the successful #276 run. P0 #202 OPEN; Release `NO-GO`, `productionApproved=false`.
