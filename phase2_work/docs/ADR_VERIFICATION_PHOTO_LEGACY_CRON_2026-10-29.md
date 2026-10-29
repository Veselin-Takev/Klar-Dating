# ADR — P0 #202: eliminate upload-age deletion of verification photos (2026-10-29)

Status: **DRAFT / REVIEW REQUIRED / PRODUCTION NO-GO**

## Decision context

Two independently scheduled functions are exported in `functions/src/index.ts`. Historical `deleteExpiredPhotosCron` deletes `verification/` Storage files based on object `timeCreated` after 30 days, even if a verification case is still pending. The policy is 30 days **after moderation decision**; the separate signed `purgeVerificationStorageCron` → compliance API → `storageRetentionEngine` implements decision-based intent. Actual deployed Scheduler state has not been checked.

## Proposed mitigation

Keep the legacy function export and schedule during controlled migration, but remove its Storage enumeration/deletion. Retain its unrelated bounded `funnel_events` expiry cleanup. Keep the signed, decision-aware path unchanged. Do not migrate or delete Cloud Functions automatically; deployment/IAM/Cloud Scheduler state requires manual rollout review. Avoid creating false `photoPurged` audit events from the legacy path.

## Threat and regression gates

The new offline test `scripts/test-verification-photo-cron-boundary.mjs` rejects the legacy bucket API, age-based scanner and Storage object delete calls, verifies both functions remain exported and that the signed route still checks decision expiry/pending state. Real emulator/Storage and staging acceptance gates remain **NOT RUN**. The code mitigation is not proof of storage cleanup completeness, legal holds, concurrency safety or active Cloud configuration.

## Rollout / rollback

1. Confirm deployed scheduled functions, last executions, permissions and logs without making changes. Decide whether a dedicated funnel cleanup should replace the legacy-named function in a later release.
2. Review data migration and pending photo inventory with DPO/Security; test decision-based purger in approved staging and verify legitimate purges/holds/retries.
3. Rollout only with independently approved, digest-pinned release evidence and a documented rollback that does not silently re-enable age-based biometric deletion. Use incident response for unaccounted deletions.
4. Product and Finance do not attest GDPR compliance; formal DPO, SRE, Security and Release Owner approvals remain mandatory.

## Open dependencies

Issue #202 source mitigation; #70 target-bound ACTIVE Firestore TTL and Legal Hold proof; #8 operational verification; independent end-to-end media lifecycle tests and deletion audit; **PRODUCTION NO-GO**.

## Storage delete generation, hold and partial-failure hardening (2026-10-29)

The signed, decision-based compliance endpoint previously used `bucket.file(path).delete({ ignoreNotFound: true })` after obtaining a Firestore snapshot. It lacked Storage generation preconditions and explicit object hold checks. In addition, `executeVerificationRetentionBatch` converts individual deletion/audit failures to `reason: error` without rejecting the batch; the HTTP route returned status 200 and included raw per-object `uid`/`storagePath` results. This could cause a Scheduler run to treat incomplete purges as success and expose unnecessary personal identifiers.

The isolated follow-up adds `deleteVerificationStorageFile`, which inspects object metadata, refuses temporary/event-based holds or absent/invalid generations, then deletes only with `ifGenerationMatch`. Metadata 404 and generation conflict 412 remain errors for independent reconciliation; a missing object is not falsely logged as a verified deletion. The API now returns aggregate counts only and status **503** if any artifact failed, prompting the signed Scheduler to retry; the transactional audit update rejects missing/rebound event records rather than silently acknowledging them. New pure mocked-file Vitest tests cover generation, holds, invalid metadata, 404 and 412; an offline source regression covers the route's guards.

**Source-only change.** This patch does not prove live Storage legal-hold semantics, a complete moderation-state concurrency lock, cleanup of already missing files, retries under production load, or immutable deletion receipts. Test execution, TypeScript/function builds and independent review remain pending. A deployed legacy cron and its timing must be separately inventoried before any release. **Production NO-GO / P0 #202 remains open.**
