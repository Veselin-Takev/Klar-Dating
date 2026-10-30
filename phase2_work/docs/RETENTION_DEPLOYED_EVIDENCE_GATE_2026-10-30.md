# P0 #202 / #70 — Deployed Retention Evidence Gate (30 October 2026)

**Status: BLOCKED / NO-GO. No live infrastructure inspection or mutation authorized by this document.**

## Code evidence verified at draft #211 ancestor
- `functions/src/deleteExpiredPhotos.ts` now retains the old `deleteExpiredPhotosCron` scheduled entrypoint but only deletes up to 400 expired `funnel_events`; it logs `verificationPhotoDeletion: disabled_in_legacy_cron`. Code no longer scans `verification/` by Storage upload age in that entrypoint.
- `functions/src/retention.ts` keeps Art.17 photo deletion across `verification/{uid}/` and `profiles/{uid}/`, using limited pages, Storage holds and `ifGenerationMatch`. A 404 is tolerated, while other failures are not treated as completion. Source behavior is not deployed-state proof.
- `docs/DATA_RETENTION.md` specifies `verification_events.fotoLoeschenAb`, decision timestamps and 30 days after moderation decision, not upload age. The signed purge endpoint and current deployed Scheduler/IAM still require verification.
- `scripts/configure-retention.sh` covers 20 collection groups under explicit dry-run and gated staging apply. A source script is **not** proof that Cloud Firestore TTL policy status is ACTIVE in any environment.

## Mandatory read-only evidence packet — assigned to Security / DPO / SRE
1. Enumerate actually deployed Functions, trigger definitions and Cloud Scheduler jobs in each target project. Confirm old entrypoint revision, Scheduler target, invocation identity, retry policies, and any duplicate or stale workers. Capture redacted resource IDs, environment, region, revision, time, audit principal and SHA; do not expose secrets.
2. Inspect deployment of `purgeVerificationStorageCron`, signed compliance endpoint and least-privilege IAM. Verify no still-live upload-age worker can delete pending biometric artifacts. Do not disable live schedules until an approved cutover/rollback exists.
3. Generate synthetic cases: old pending image MUST remain; approved/rejected image only after decision-based deadline; invalid/missing decision MUST remain; legal hold MUST remain; generation conflict 412 MUST not remove replacement; retryable 404/reconciliation and 503 backlog must be auditable. Run in isolated approved staging.
4. For each approved Firestore collection group, capture actual `expiresAt` TTL policy metadata and **ACTIVE** status with environment and database IDs. Reconcile the exact approved 20-group matrix with written legal retention rationale and legal holds. Never activate new TTL policies on the basis of documentation alone.
5. Inspect dashboard/alerts and failure backlog for bounded cursor scanning, stuck leases and partial deletion. Demonstrate an incident and rollback rehearsal while preserving legal holds.
6. Bind evidence to exact staging code SHA and configured Cloud Run/Functions revisions; require independent DPO/Legal, Security, SRE and Release Owner signoff; attach redacted references to issues #202, #70 and #8.

## Evidence classification
**Source verified**: above code statements on stacked candidate branch. **CI**: prior draft #210 exact-head PASS is not live operational proof. **Not verified**: deployed functions, cloud IAM, Scheduler inventory, real TTL policies, legal holds, post-deployment behavior and release approvals. Until signed evidence exists, neither P0 issue is closed and **PRODUCTION NO-GO** remains.

## Change-control
Documentation-only branch created while draft #211 CI was **in_progress** (GitHub run 41026532065); do not open another PR or trigger additional workflows while this run remains active. Preserve main, PR #119/RC R2 and customer data untouched.
