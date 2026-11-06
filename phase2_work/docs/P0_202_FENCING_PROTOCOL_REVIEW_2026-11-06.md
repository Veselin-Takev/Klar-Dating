# VES-5 — Cross-service Fencing Protocol: Design and Pre-integration Guard

**Date:** 2026-11-06 · **Stage:** development draft / design contract, **NOT a deployed or end-to-end solution** · **Release:** P0 NO-GO, `productionApproved=false`.

## Why the existing technique cannot pass P0

The current purge route (`src/server/routes/complianceStorage.ts`) commits an intent to Firestore, revalidates eligibility in a transaction, and later issues a GCS `file.delete({ifGenerationMatch})`. The GCS generation precondition protects object replacement, **not concurrent changes of a Firestore decision or legal hold**. A post-final-check decision update can still commit before Storage deletion. An additional read, another transaction, a short Firestore lease or a renamed token does not make these two systems atomic. The existing adversarial Vitest case deliberately documents that unsafe interleaving.

## New review-only contract

`src/server/platform/verificationPurgeFence.ts` introduces a **pure, non-deployed reference protocol** with an immutable monotonic epoch and persisted state transitions:

| Phase | Meaning | Allowed transitions |
| --- | --- | --- |
| `open` | Decision is pending/approved/rejected, optional hold | Decision/hold transitions increment epoch; eligible and not held may be claimed |
| `deleting` | Exclusive in-flight permit, UUIDv4, fixed GCS generation | Only the exact permit may complete with a receipt; moderation/hold mutation attempts are rejected, not falsely acknowledged |
| `deleted` | Fixed, generation-bound proof | No reissue of permit or retroactive decision mutation on this event |

The model does **not** expire `deleting` simply because a lease expires. An already-submitted GCS operation may complete after Firestore's lease deadline. Crash recovery requires external reconciliation of the in-flight GCS call and audit-proof generation, under an independently defined runbook.

**Legal-hold limitation:** If a Legal Hold arrives while deletion is in flight, the prototype *rejects acknowledgement* and raises `verification_purge_hold_requires_storage_interlock`. A real live implementation must prevent any false assertion that the hold has taken effect; it needs a GCS object hold and a coordinated request/acknowledgement protocol, or an explicit decision that the ongoing purge cannot be canceled once reserved. DPO/Legal must approve behavior and user communication. Do not turn this model into a promise that every last-second hold can stop a previously-submitted GCS request.

## Current production-code safety improvement (deliberately restrictive)

The existing route's `assertStillEligibleForPurge` rejects **any** `photoPurgeFence` field in a verification event with `verification_photo_fence_protocol_not_yet_wired`. This makes a partial migration fail closed: a document marked as fenced may not be processed by the old last-check-only purge path. There is no code to write that field during normal production; the old P0 constant remains `VERIFICATION_PHOTO_PURGE_P0_LIVE_RELEASE_APPROVED = false`. A new Firestore emulator regression inserts a synthetic `photoPurgeFence` into a due event and expects HTTP 503, zero physical Storage deletion calls and no audit receipt. This is a negative safety check, not an enabling switch.

## Required next implementation — all mandatory for P0 GO

1. **Firestore transactional integration.** Persist epoch/token on a canonical per-event (or per-owner) fencing document in the same transaction as `photoPurgeIntent`; a single atomic update must reserve the delete slot *before* the final Storage call. Audit must verify the exact permit/generation and no foreign writer can supersede it.
2. **Mandatory adoption by every writer.** All decision/revocation routes, legal-hold services, the account-deletion path (`trustAndSafety.ts` -> `functions/src/retention.ts`), legacy moderation and external Admin SDK jobs must use the same transactional coordinator before modifying the related event and/or Storage object. A preflight read followed by a write is insufficient.
3. **GCS Storage IAM and hold interlock.** Verify all privileged writers with deploy-time IAM evidence. Object generation CAS and applicable temporary/event holds must be enforced. Define exactly when a pending Legal Hold is considered effective and how a concurrent delete is stopped or reported. Firebase Storage Rules alone do **not** restrict Admin SDK writers.
4. **Adversarial integrated tests.** In Firestore and Storage emulators, pause the worker after the *last* eligibility authorization but before the GCS delete, then attempt moderation revocation and legal hold via **all real writer APIs**. A decision/hold must either be safely deferred/rejected (no false success) or the object deletion must fail; never commit a successful revocation/hold while deleting. Test generation replacement, 404/412, stale workers, crash/replay, Art.17, reuploads and object-hold semantics.
5. **Safety and liveness.** A crash must not auto-release an in-flight deletion lock. Design human/operator recovery, durable backlog accounting, bounded retries, retention deadlines, escalation and idempotent audit. No unbounded forever-lock without a DPO-approved recovery playbook.
6. **Independent evidence and approvals.** Exact-SHA CI, staging adversarial proof, source and runtime writer inventory, Cloud IAM/Scheduler/TTL/hold evidence, and independent AppSec, DPO/Legal, SRE and Release Owner approvals. Only thereafter may production release gating be revisited.

## Tests and evidence

- `tests/verificationPurgeFence.spec.ts` exercises a deterministic **model-level** post-authorization interleaving: attempting a decision update while a permit is active fails and is not falsely acknowledged. Also tests pre-existing holds, in-flight hold refusal, stale tokens, duplicate claims, no time-expiry, monotonic epochs and malformed proofs.
- `tests/verificationPurgeHttpEmulator.spec.ts` adds a **real Firestore-emulator route** regression that prevents the legacy route from deleting a synthetic fenced document. This is separate from and weaker than an all-writer concurrency integration test.
- The existing test `exposes the cross-service authorization-to-delete race for review` remains intact: this gap must not be erased by merely adding a state machine that the actual writers do not yet use.

**Non-goals:** no production flag activation, no live GCS operations, no IAM mutation, no automatic cleanup, no merging into `main`, no assertion that P0 is fixed.
