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
