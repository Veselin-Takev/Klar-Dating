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

## 06.11.2026 – Firestore transaction adapter and first real writer adoption (Draft)

A separate review branch now adds `src/server/platform/verificationPurgeFirestoreFence.ts` to persist the pure fence contract through Firestore `runTransaction`. Each operation reads and writes the **same** `verification_events/{eventId}` document in one transaction: `reserveVerificationPurgeEvent` commits the exclusive `deleting` token and GCS generation; `transactVerificationEventDecision` updates the canonical/legacy decision fields together with the epoch; and `transactVerificationEventLegalHold` refuses a hold acknowledgement while deletion is already reserved. Missing/corrupt/uncoordinated state, inconsistent decision fields, wrong collection IDs and UID/storage owner mismatches are rejected rather than silently migrated. **These new transaction methods are not yet invoked by the old destructive purge or all other writers.**

The existing moderation decision writer in `src/server/klarCore.ts` now creates `photoPurgeFence: initialVerificationEventFence(...)` in the **same existing transaction** that creates each verification event and updates the user/request. The source inventory requires that exact initialization to remain present. This is *one* real writer integration, not comprehensive all-writer adoption. Because the older purge deliberately fails closed on any `photoPurgeFence`, this partial migration makes newly created events **ineligible for the legacy destructive path** until the approved integrated coordinator replaces it. DPO/SRE must monitor the retention backlog and provide legal escalation during the continuing P0 production veto; no temporary switch may bypass the lock.

A new dedicated Firestore-emulator Vitest suite tests actual transactional state persistence, simulated post-reservation moderation revocation, in-flight hold refusal, hold-first prevention, duplicated permit reservations, missing fence documents, decision drift, owner-path checks and invalid refs. This is still **not** a real GCS request under an adversarial Firestore writer; the original failing characterization of the cross-system TOCTOU remains a separate outstanding release gate.

The source-only `check-verification-event-writers.mjs` and `check-verification-storage-writers.mjs` explicitly inventory the new helper and atomic moderation initialization. They do **not** detect all external Admin SDK clients, dynamic path aliases, console actions or Cloud IAM bindings.

**Remaining mandatory P0 work:** wire *every* moderation, revocation, legal hold, Art.17 and external storage deletion writer into the same persisted transaction protocol; enforce GCS-side hold/lease semantics and IAM boundaries; implement crash-safe reconciliation, durable audit proof and no unsafe time-based fence release; execute real cross-service adversarial tests after the last authorization; obtain independent AppSec/DPO/SRE/Release Owner sign-offs. The constant `VERIFICATION_PHOTO_PURGE_P0_LIVE_RELEASE_APPROVED = false` remains unchanged. No merge/deploy, `productionApproved=false`, NO-GO.

## 06.11.2026 – Uncoordinated Admin SDK writer regression (review-only)

A further **local Firestore-emulator characterization test** (`tests/verificationPurgeFirestoreFence.spec.ts`) deliberately reserves a valid `deleting` permit and then performs a plain privileged `ref.update` that bypasses the new coordinator. The expected, deliberately unsafe observation is that the canonical decision can change to `abgelehnt` while the persisted fence still says `deleting/approved`. The compliant helper subsequently detects decision drift, but **cannot retrospectively undo the privileged mutation or stop an already scheduled GCS delete**. There is no GCS call in this regression. This is a fail-open external-writer characterization, **not** a passed P0 mitigation test.

This negative result makes mandatory all-writer adoption and deployed IAM restrictions explicit: no sign-off while an external Admin SDK/service account, account-erasure routine, console operation or dynamic helper can update event decisions or physical Storage objects without the same enforcement contract. Firestore emulator coverage of the coordinator is necessary but insufficient; test every actual writer under adversarial pause after reservation and before GCS delete and reconcile legal holds, 404/412, crash/replay, TTL and Art.17 with DPO/SRE.

The production purge source veto remains unchanged (`VERIFICATION_PHOTO_PURGE_P0_LIVE_RELEASE_APPROVED=false`). The test/documentation additions are a Draft review-only step. CI is **not** claimed successful until the exact new commit is checked. `productionApproved=false`, **P0 OPEN / NO-GO**.

### Additional bypass characterization: false hold acknowledgement after reserve

A second Firestore-emulator regression deliberately overwrites the persisted `deleting` state with an `open/legalHold=true` document through a privileged, **nonparticipating** writer after a valid reservation. The database accepts the write, even though the already-issued GCS permit cannot be canceled by this Firestore update. The later compliant reservation correctly refuses the hold, but that does **not** retroactively make the original deletion safe. The test performs no GCS call and does not assert that this unauthorized state transition is prevented.

**Required P0 closure:** inventory/restrict every privileged writer and forbid direct mutation of the fence, coordinate storage-side holds before acknowledging a hold, and test the actual GCS operation under a deterministic post-reservation interleaving. Independent Cloud IAM/AppSec/DPO/SRE evidence remains missing. `productionApproved=false`; live purge veto remains disabled. New exact-SHA CI must be read back.

## 06.11.2026 – Retention eligibility and generation-bound intent are now atomic (Draft increment)

The review-only `reserveVerificationPurgeEvent` helper has been hardened so a transaction **cannot** claim a deletion permit solely because the current moderation status is approved/rejected. On the same `verification_events/{id}` snapshot it verifies:
- `photoPurged === false`, no previous proof and no `photoPurgedAt` (ambiguous historical state must be reconciled, not deleted again);
- a consistent moderation decision with the persisted fence, an owner-matching nonempty `verification/{uid}/...` path and an `open` fence without legal hold;
- valid Firestore decision and scheduled-due timestamps; both the scheduled time **and** the 30-day period from `decidedAt` must be elapsed according to the service clock;
- any preexisting `photoPurgeIntent` must exactly match the same GCS generation, owner path, decidedAt, status and original preparation time. A different intent is never overwritten.

On success, **one Firestore transaction** writes both the monotonically versioned `deleting` permit and `photoPurgeIntent` containing the exact GCS generation and current canonical event identity. This is a prerequisite for future all-writer coordination, not permission to call GCS; the helper still performs **zero** Storage operations and the legacy purge still rejects all fenced events.

The Firestore-emulator tests now cover expiry-before-due, a future scheduled date, invalid/missing dates, prior purge receipts, inconsistent generation/intent, matching existing intent, no unintended write on failure, concurrent reservations and hold/revocation semantics. The static Storage writer inventory checks that **both** permit and intent appear in the same `tx.update` and that 30-day eligibility cannot silently disappear; mutation regressions test those guards.

**Not resolved:** actual Storage generation metadata authenticity, physical Cloud Storage deletion, legal hold/GCS IAM interlock, external writer adoption, Art.17 ownership, unsafe cross-service interleaving, crash-safe reconciliation and DPO-approved retention backlog. A successful Firestore check does not prove atomicity with GCS. P0 VES-5 remains OPEN; productively destructive purge stays source-locked, `productionApproved=false`, NO-GO. Before approvals, do not merge or deploy this Draft PR.


### CI evidence: VES-5 atomic reservation PR #332 (06.11.2026)

The first exact-head GitHub [Enterprise CI #1788](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/42190984406) on commit `ee2cf0afab53580058828be2a202f34478f59a12` finished **FAIL** at `Enterprise static gates`: the lexical verification Storage source inventory expected one `verification/` literal in the transactional helper, but the new explicit nonempty owner path guard used a second literal. Four source-inventory fixture checks failed from the same baseline mismatch. This was a **guard inventory mismatch**, not permission to skip the checks. Commit `3e2836cc174dcef0d9474726c00c2c57a63db955` updates the approved source inventory count to two while preserving the owner prefix, nonempty suffix check, 30-day deadline check, and atomic permit+intent requirement. Fresh [Enterprise CI #1789](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/42191278938) was started for that head; until its completion this PR is **NOT** CI-approved. The independently deployed GCS/Firestore race remains P0 **OPEN**, no merge/deploy and `productionApproved=false`.

### Clock-skew guard: future moderation decisions (Review-only)

The transactional reservation now explicitly refuses a `decidedAt` timestamp later than the service clock, even if another due field is backdated. A deterministic Firestore-emulator negative test requires `verification_purge_fence_retention_not_due`, leaves the permit in `open`, and writes no `photoPurgeIntent`. This check is redundant with the current minimum-30-days calculation for valid nonnegative durations, but makes the future-timestamp invariant explicit and protects future policy refactors. It does **not** establish Cloud clock accuracy, GCS object identity, or cross-service atomicity.

The first static-gate count failure in CI #42190984406 belongs to an **older** PR head; it was already adjusted by the existing branch before this follow-up. The exact new commit's CI must be checked independently. `productionApproved=false`, P0 still open, no production purge.

## 06.11.2026 – Replay-safe storage intent: no silent legacy intent takeover (Draft PR #333)

The Firestore-only `reserveVerificationPurgeEvent` helper formerly admitted a **matching preexisting** `photoPurgeIntent` when its GCS generation/path/status/timestamp matched, then created a *new* `deleting` permit. This is not a safe assumption after worker failure: the previous request could still be in flight in GCS even if the old Firestore lease elapsed. A freshly issued permit must never silently inherit the old object-deletion claim.

The helper now checks property presence (including null or malformed markers) and **rejects any preexisting `photoPurgeIntent`** with `verification_purge_fence_prior_intent_requires_reconciliation`. No new permit/intent is written on this path. This intentionally requires an independent operator-controlled reconciliation based on the original object generation, Cloud Storage operation state/absence and audit evidence. It is **not** a license to delete the old field or to reset a `deleting` fence after a timeout. An unresolved intent must be accounted for in the DPO/SRE retention backlog.

For newly prepared and otherwise eligible events, the **same Firestore transaction** now persists `photoPurgeFence` plus `photoPurgeIntent` with `generation`, canonical path/status/timestamp, `permitId: next.permitId` and `fenceEpoch: next.epoch`. This binds the durable claim to one exact version of the exclusive fence. Repeated reservation while `deleting` remains fail-closed. Emulator tests cover matching conflicting/old/null prior intents, stale worker retries, token/epoch matching and no partial writes. The source inventory and mutation tests fail if token/epoch binding or the no-reuse guard disappears.

**Operational impact:** previously compatible but unaudited legacy intents will be blocked instead of automatically resumed; a lawful, bounded and evidence-backed reconciliation workflow is still missing. This is a conservative security prerequisite, not a completed retention deletion solution. There is **no GCS call**, no Cloud IAM mutation, no unsafe automatic reauthorization and no production activation. `VERIFICATION_PHOTO_PURGE_P0_LIVE_RELEASE_APPROVED=false` remains in force. All-writer adoption, external identities, object holds, real adversarial interleavings, Art.17 coordination and independent AppSec/DPO/SRE/Release Owner review remain P0 release gates; `productionApproved=false`, NO-GO.

### 06.11.2026 – Exact-head CI failure #1792 and fail-closed error-precedence fix

[Enterprise CI #1792](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/42193559382), on PR #333 head `4a2e18b37d7d1707e2081b80c87996884f76ef88`, **FAILED** in `Tests`: the real Firestore emulator reported **1,528 passed / 2 failed** Vitest tests (199 files, one failing). Both were guard-precedence regressions in `tests/verificationPurgeFirestoreFence.spec.ts`: an already-deleting fence returned `verification_purge_fence_prior_intent_requires_reconciliation` because the new prior-intent guard ran before `startVerificationPurgeFence`. The expected reasons were `verification_purge_fence_already_claimed` (stale retry) and `verification_purge_fence_legal_hold` (synthetic uncoordinated hold). The operation was still rejected with no new write; the *failure classification* was wrong.

The corrective code checks the in-memory state-machine precondition **first** (`startVerificationPurgeFence` performs validation only), then rejects any prior `photoPurgeIntent` **before** the single `tx.update` of permit plus intent. Thus occupied, held and otherwise ineligible states retain their explicit error contracts, while any `open` state with an unresolved old intent is still blocked from reauthorization. No earlier GCS operation may be silently reused and the live-purge P0 veto remains unchanged.

CI success must be shown on the **final** SHA after this documentation update. Even a green CI does not close P0 VES-5: third-party writers, GCS IAM, hold interlock, crash reconciliation and post-authorization cross-service interleavings are still unresolved. Draft only, no merge/deploy, `productionApproved=false`, **NO-GO**.

## 06.11.2026 – Decision/Legal-Hold writers must not acknowledge unresolved Storage outcomes (review-only)

The Firestore-only helper previously checked the persisted `photoPurgeFence` phase but could still accept `transactVerificationEventDecision` or `transactVerificationEventLegalHold` on an `open` fence while the event was already marked `photoPurged`, had a `photoPurgeProof` or `photoPurgedAt`, or carried a prior `photoPurgeIntent`. Such inconsistent states could arise from a legacy/privileged writer or a partial migration. A new moderator acknowledgement or effective legal-hold acknowledgement on an already-removed object would be misleading.

Both transactional writer methods now read the complete event snapshot and invoke `assertWriterHasNoUnreconciledPurgeState(data)` **after the pure state-machine transition checks** and **before any Firestore mutation**. The guard requires `photoPurged === false`, and rejects the **presence** of old `photoPurgeIntent`, `photoPurgeProof` or `photoPurgedAt` (including null/invalid marker values). Errors fail closed with `verification_purge_fence_writer_requires_reconciliation`, leaving decision, hold and fence state unchanged. Explicit `deleting`/busy and in-flight-hold error classifications retain precedence. Valid `open` events without ambiguous Storage state still permit coordinated decisions and pre-delete legal holds.

Firestore emulator regressions cover old intent, null intent, already-purged flag, proof and audit timestamps. The static Storage-writer source inventory now demands both writer call sites and the deleted-photo check; mutation fixtures remove each check independently and assert CI failure. The checks do **not** make the actual GCS operation cancellable and do **not** impose a protection on Admin SDK writes that bypass this helper.

**DPO/operational caveat:** refusing to acknowledge an uncoordinated hold means the hold is **not confirmed effective**; the request must be escalated for independent Storage state, GCS object-hold and deletion audit reconciliation. Never silently claim that a late legal hold succeeded. This conservative fail-closed path can grow the retention/manual-review backlog; SRE/DPO must maintain bounded recovery and evidence. Live purge remains source-disabled. All-writer adoption, GCS IAM/holds, Art.17 coordination, adversarial cross-system tests and independent signoffs remain P0 unresolved. `productionApproved=false` / NO-GO, no merge/deploy.

## 06.11.2026 – Fail-closed für unbekannte Felder in persistierten Fencing-Zuständen (Draft PR #335)

Der Firestore-Adapter akzeptierte bisher ansonsten wohlgeformte `photoPurgeFence`-Daten auch dann, wenn ein privilegierter Alt-/Fremd-Writer zusätzlich Marker wie `pendingLegalHold`, `holdRequested`, `recoveryClaim` oder `migrationMarker` hinterlegt hatte. Der Parser stellte nur die bekannten Felder wieder her und **verwarf unbekannte Angaben stillschweigend**. Bei einem rechtlich wirksamen Hold- oder Recovery-Hinweis ist dies keine zulässige Annahme: Der Writer könnte eine Reservierung oder neue Moderationsbestätigung auf Grundlage unvollständiger Bedeutung zulassen.

`parsePersistedVerificationPurgeFence` verlangt jetzt eine **exakt definierte Feldmenge pro Zustand**: `open` = phase, epoch, decision, legalHold; `deleting` = diese vier plus permitId und generation; `deleted` = phase, epoch, decision, permitId, generation, receiptDigest. Fehlende, zusätzliche oder nicht zum Zustand passende Felder brechen mit `verification_purge_fence_record_invalid` ab, **vor jeder transaktionalen Mutation**. Legitime kanonische Zustände bleiben unverändert zulässig. Neue Pure-Vitest-Regressionen prüfen alle drei Phasen; ein Firestore-Emulator-HTTP-freier Transaktionstest beweist, dass ein synthetischer `pendingLegalHold` weder Löschreservierung noch Entscheidungs- oder Legal-Hold-Acknowledgement passieren lässt und kein neues `photoPurgeIntent` entsteht. Source-Inventar- und Mutationstests verhindern eine unbemerkte Entfernung dieser Grenze.

**Migrationshinweis:** Jede spätere Erweiterung der Fencing-Zustände erfordert eine explizite versionierte Schema- und Writer-Migration; ein unbekannter Sidecar-Marker darf nicht durch Entfernen des Validators „repariert“ werden. Bestandsdaten mit unbekannten Markern benötigen DPO-/AppSec-begleitete Reconciliation; keine automatische Lease-Freigabe. Diese Änderung betrifft **nur die teilnehmenden Firestore-Helfer**, nicht externe Admin SDKs, GCS IAM/Object-Holds oder das Post-Authorization-TOCTOU. Destruktive Route bleibt source-locked, P0 VES-5 OPEN, `productionApproved=false`, **NO-GO**, Draft/unmerged.

## 06.11.2026 – Root-only event references and owner-bound all-writer methods (Draft PR #336)

**Security gap:** The Firestore-only `assertEventRef` previously checked only `ref.parent.id === 'verification_events'` and a nonempty ID, which also admits a nested reference such as `tenants/{tenant}/verification_events/{event}`. That path has not gone through authenticated tenant resolution or a reviewed cross-tenant write policy. Owner-to-Storage-prefix binding was enforced only by `reserveVerificationPurgeEvent`, not by `transactVerificationEventDecision` or `transactVerificationEventLegalHold`.

**Fail-closed change:** `assertEventRef` now requires exactly `verification_events/{eventId}`. All three transactional methods use `assertVerificationEventOwnerPath`: the UID must be nonempty, whitespace-stable and contain no slash/backslash; the Storage path must start with `verification/{uid}/` and have a nonempty object suffix. The check takes place before each Firestore update; nested refs are rejected before a transaction starts. This is explicitly root-only and does NOT implement tenant-aware resolution.

**Evidence:** Firestore emulator tests cover foreign Storage owner for all three APIs, empty file suffix, slash-bearing UID and nested tenant references (no mutation). Both static writer inventories and mutation tests pin root canonical path and all three owner checks. No destructive Storage operation, IAM modification, merge or release-flag change.

**Remaining P0:** Nonparticipating Admin SDK writers, account erasure, real GCS legal-hold/operation interlocks, Cloud IAM and Firestore/GCS post-final-check TOCTOU are still unresolved. Future tenant-hierarchical event schema needs explicit versioned, authorized migration. `VERIFICATION_PHOTO_PURGE_P0_LIVE_RELEASE_APPROVED=false`, `productionApproved=false`, VES-5 P0 OPEN / NO-GO.
