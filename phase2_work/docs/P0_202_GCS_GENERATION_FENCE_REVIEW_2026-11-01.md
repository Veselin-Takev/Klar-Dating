# P0 #202 — Decision recheck and GCS generation-fenced purge

**Date:** 2026-11-01  
**Parent:** Draft PR #269 exact head `54ef22b87d40c90711e575d7e133b9311417f2f1`. This is a STACKED **DRAFT**; neither parent nor this change is merged or deployed.  
**Status:** BLOCKED / PRODUCTION NO-GO.

## Source-confirmed defect

`src/server/routes/complianceStorage.ts` previously called `bucket.file(path).delete({ ignoreNotFound: true })` after scanning Firestore due verification events. It lacked an object-generation precondition and did not reread the decision before deleting, so a replaced GCS object at the same path could be deleted unintentionally. The transaction writing `photoPurged` also silently returned if the document was absent/wrong UID, allowing a false successful batch receipt. Independently, the old upload-age scheduler is addressed only in the parent Draft #269.

## Isolated changes in this Draft

1. Pure `src/server/platform/verificationPurgeBoundary.ts` validates a current Firestore decision against the captured UID, path, state, `decidedAt`, due timestamp, 30-day minimum, `photoPurged` and known hold flags. Contradictory `status`/`entscheidung` values are denied; unknown states do not default to approved.
2. Immediately before GCS mutation, the route rereads `verification_events/{challengeId}`, checks this boundary, obtains the live object generation and checks temporary/event-based holds and `retentionExpirationTime`. The delete request then passes `ifGenerationMatch`. A `412` replacement race must fail without deleting the replacement. `404` must not be falsely recorded as successful.
3. The Firestore transaction rechecks the recorded UID/decision/path before persisting a purge receipt; silent success on an absent or changed event is forbidden.
4. `storageRetentionEngine.ts` forwards the candidate context to the deletion callback without altering existing policy-selection behavior. `tests/verificationPurgeBoundary.spec.ts` includes synthetic negative cases (status conflict, missing/changed decision, foreign UID/path, early expiry, hold, invalid/replaced generation) and positive cases.
5. Existing `check:compliance-storage-purge` now asserts the recheck and generation-fenced delete are present and the previous unversioned `ignoreNotFound` call is absent.

**Reference:** [Google Cloud Storage generation preconditions](https://cloud.google.com/storage/docs/request-preconditions); precondition mismatch returns HTTP 412. Source and fixtures are not evidence of a successful GCS request.

## Remaining unverified security and operational boundaries

- A Firestore decision may still change **between** its last read and the GCS call. An immutable decision schema or approved transaction-owned lease/write fence is required to prove an atomic business invariant; this patch narrows, but does not eliminate, the cross-system TOCTOU window.
- A failed audit write after a successful GCS delete can leave the data deleted and the receipt incomplete. This must be reconciled with an idempotent, resumable authoritative ledger. Do **not** mark success on 404 without independently verified prior receipt.
- The exact storage bucket metadata schema, retention/temporary holds, legal-hold policy/permissions and generation-conditioned delete must be independently tested with the Firebase Storage Emulator and an approved **staging GCS bucket**. Synthetic TypeScript mocks are insufficient.
- Legacy worker deployed state remains unknown; parent #269 is source-only.
- The parent #269 and other stacked #231/#233/#242/#250/#252 changes must be reconciled by code-owner review before any candidate merge or rollout.
- No real Cloud deployment, Scheduler/IAM change, customer photo deletion, or release approval was performed. The latest exact SHA must pass CI before claiming source validation. DPO/Legal/SRE/AppSec/Release Owner signoff is missing.

**P0 #202 OPEN. Production NO-GO.**

## 2026-11-01 — Scheduled-job acknowledgement and privacy follow-up

A second source-backed P0 failure mode was identified: `storageRetentionEngine.ts` catches per-photo GCS/transaction failures and returns `reason: 'error'` for affected items, while `complianceStorage.ts` had returned HTTP `200 { ok: true, ...summary }` regardless. The signed `purgeVerificationStorageCron` checks only `response.ok`, so partial failure could be silently acknowledged and never retried by the scheduler. The route response also exposed raw `uid`, `challengeId`, `storagePath`, digest and provider `error` through the `results` array.

The source-only follow-up changes the HTTP contract: any failed per-photo action, malformed due Firestore record or internally inconsistent summary yields **HTTP 503** and code `verification_storage_purge_incomplete`, forcing the scheduler to treat it as failed. Both complete and failed responses use aggregate-only counts, never per-object/user strings or provider errors. `tests/verificationPurgeHttp.spec.ts` exercises real signed HTTP requests to an isolated Express instance backed by synthetic in-memory Firestore/GCS doubles: a GCS-412-like exception, mixed success/failure, complete success, malformed due record and an invalid HMAC. The mandatory `check:compliance-storage-purge` source gate now rejects regression to HTTP-200-on-partial-failure.

**Evidence boundary:** A 503 creates a retry signal but does not prove retries occurred, that the daily scheduler catches every due page, or that a successful GCS delete followed by a failed Firestore receipt is reconciled. A strict resumable receipt/lease protocol, precondition-aware negative staging GCS tests, bounded paging, privacy-reviewed response metrics and SRE/DPO/AppSec signoff are still necessary. This latest commit requires exact-head CI; earlier PASS #41285159760 validates only the predecessor SHA. No deployment or production data changes. **NO-GO.**
