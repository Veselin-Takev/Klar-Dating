# VES-5 | Blocked verification-photo deletion: DPO/SRE exception-handling playbook

**Date:** 2026-11-08 · **Owner approval:** PENDING · **Production release:** NO-GO

This is a **review draft**, not an instruction to bypass the P0 security interlocks or a substitute for Legal/DPO judgment. The staged fixes in [Draft #348](https://github.com/Veselin-Takev/Klar-Dating/pull/348) and [Draft #349](https://github.com/Veselin-Takev/Klar-Dating/pull/349) are unmerged and are not evidence that the production environment currently enforces these controls.

## Why two independent workflows must be monitored

1. **Scheduled verification-photo retention:** `/api/admin/purge-verification-storage` might return 503 `verification_storage_purge_p0_fencing_unverified` when a signed, otherwise valid request attempts to use the unfenced Firestore/GCS deletion path. Any 503 is **not** successful retention processing.
2. **User-requested account erasure / DSGVO Art. 17:** `purgeAccountData()` has a different Storage path. If its verification prefix contains any object, the proposed safer code blocks completion with `verification_photo_p0_fencing_unverified` instead of issuing an unauthorized GCS delete. A durable account-deletion job must remain **pending**; do not publish an erasure-complete receipt, close the deletion ticket or silently reclassify the failure as resolved.

The two changes do not replace all-writer fencing. Firestore moderation decisions and storage object generation are different consistency domains; late hold changes must remain a release-blocking race until properly prevented.

## Daily exception review (read-only unless specifically approved)

- **DPO/Privacy owner:** Review the oldest unresolved erasure and scheduled-retention exceptions against the **current approved legal service deadlines**, including the date of the original request, the reason for any legal hold and any required response to the requester. Never assume that a security hold automatically extends a statutory response obligation.
- **SRE:** Monitor the number, age and retry state of pending deletion jobs and 503 retention outcomes. Make failures observable and alert on a threshold **agreed with the DPO and release owner**. Log opaque job IDs and redacted error codes, not verification photos, names, addresses or raw biometric material.
- **Trust & Safety:** Independently confirm the business grounds for any hold/revocation and record who authorized it, when it began, and when it must be reviewed. Distinguish a legitimate lawful hold from a software consistency failure.
- **AppSec + Engineering:** Verify whether a blocked operation came from scheduled purge, account erasure, or an unreviewed external Admin SDK/GCS writer. Collect code SHA, service principal, affected tenant/project/bucket name, run ID and source of the deletion intent without exporting the actual image.
- **Release Owner:** Keep `productionApproved=false`, purge opt-in OFF and relevant P0 issues open until the supported cross-service protocol, independent reviews and staging evidence exist.

## Triage outcomes

| Case | Safe disposition | Evidence to retain |
| --- | --- | --- |
| Active and independently justified legal hold | Do not delete without authoritative hold review; assess legal communication and deadlines | Hold reference, authority, review date, sanitized job ID |
| Unfenced verification object, no approved hold | Maintain pending deletion exception; escalate for an independently reviewed safe solution **without** enabling the unsafe purge flag or test override | P0 code path, bucket/project metadata, age of request, escalation owner |
| Storage object already absent | Require the established generation/intent/audit reconciliation; do not treat an uncorroborated 404 as proof the request was completed | Intent generation and reconciliation receipt, relevant SHA |
| Object created or decision changed during workflow | Stop and record a concurrency exception; require the adversarial late-hold protection proof | Sanitized state-transition ordering, negative race test |
| Cloud project/bucket identity unknown | Fail closed; do not guess a default storage bucket or deploy another project | Explicit project ID, bucket name, IAM/scheduler inventory |

## Prohibited shortcuts

Do **not** run ad hoc `gsutil rm` / `gcloud storage rm`, toggle the unfinished purge flag, inject `getBucket` into the normal server, set the `unsafe-emulator-test-only` argument in production, mark a failed account deletion completed, or alter storage retention and legal holds as a workaround. An extraordinary deletion procedure, if legally required, needs its **own** documented authorization, scope, IAM checks, auditable implementation, independent approvers and test evidence; this draft does not authorize one.

## Release acceptance evidence

- Full writer inventory: scheduled purge, account erasure, moderation, outside Admin SDKs, Cloud Storage IAM, legacy Cloud Scheduler / TTL, tenant boundary.
- Monotonic cross-service deletion state machine with an enforced all-writer fence; no deletion after a late legal-hold/revocation committed **between** final Firestore authorization and GCS delete.
- Deterministic negative test, crash/retry, stale lease, 404/412, GCS object holds/generation changes, idempotent audit and Art.17 behavior on emulators plus approved isolated staging.
- Independently confirmed Firebase project/bucket identity, IAM, Scheduler inventory, budget gate and signed Cloud and CI evidence tied to exact integrated SHA.
- Independent signatures: AppSec, DPO/Legal, Trust & Safety, SRE, Release Owner. Each can record OPEN/REJECTED; the absence of a signature is never a silent approval.

**Current decision:** P0 VES-5 OPEN · code containment on unmerged Drafts · **NO-GO**.
