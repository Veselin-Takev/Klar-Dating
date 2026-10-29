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

## Removal of obsolete upload-age scanner and false-positive tests

The old `functions/src/retention.ts` export `deleteExpiredPhotoPage` remained callable after its scheduler was disabled. `tests/photoRetention.spec.ts` and `tests/storageRules.spec.ts` still demonstrated deleting blobs solely from their upload timestamps; this conflicted with the intended moderation decision policy and could misleadingly pass CI. The isolated follow-up removes the exported scanner (while preserving `deleteAccountPhotos` for Article 17), replaces age-based tests with account-erasure boundaries and **pending-versus-approved decision** integration checks, and extends the offline source gate so the scanner cannot silently return. No active Cloud Scheduler or stored user object is modified by this source change. **All new Node/Vitest/Storage Emulator tests remain UNEXECUTED pending an approved CI/runtime budget.** Do not interpret this patch as proof of the live deletion schedule, holds, or moderator race safety; issue #202 remains P0 OPEN / Production NO-GO.

## Remaining bounded-query starvation risk (P0 acceptance gate)

`/api/admin/purge-verification-storage` currently uses `verification_events.where('fotoLoeschenAb','<=', now).limit(100)` and does not have a checkpointed pagination scheme. Eligible, already-purged records can retain the due timestamp and be reselected; malformed/pending records with a due marker are also skipped without being moved out of the bounded window. If 100 such records occupy the first page, other due photos could be delayed indefinitely. The follow-up **must** define an approved bounded scan/checkpoint or quarantine protocol and prove fairness/eventual progress with >100 fixtures, stable ordering, failed audit updates, recovery and legal holds. This source fix alone does not close that acceptance gate and cannot certify GDPR storage limitation.

The runtime available to this review contains Node 22.16.0 rather than required 22.23.3 and no local repository checkout; GitHub-connected source assertions are not a substitute for exact-head CI, TypeScript, emulator and staged job evidence. No scheduler or data mutations were performed. **P0 OPEN / Production NO-GO.**

## Resumable, bounded purge scan and TTL/fairness review (2026-10-29)

The isolated change adds `src/server/platform/verificationPurgeScan.ts` (pure, bounded cursor traversal) and a Firestore scan checkpoint in `system/verification_photo_purge_scan_v1`. A transactionally held five-minute lease serializes purge scans, while query order is **fotoLoeschenAb ASC, document ID ASC**; cursor state includes exact seconds, nanoseconds and ID to avoid collisions. Each signed HTTP request processes at most four 25-item pages and stops at a ~100-second page boundary. After every completed page, a transactional checkpoint is stored; a process crash repeats at most that page, for which the purge path must remain idempotent. Empty or partial pages reset the cursor to resume at the beginning next invocation. **Failed or ineligible records are counted as failures, not silently lost; the checkpoint advances so they cannot monopolize page 1, and retries revisit them after wrap.**

A 503 signals either pending backlog or failures and triggers the existing scheduled retry policy; the HTTP body exposes aggregate counters only. This may increase temporary retry volume when large backlogs exist, so SRE must approve schedule, metrics, quotas, checkpoint expiry, error budgets and operational rollback. Lease release, checkpoint integrity and sorted-cursor validation are strict and fail closed; the mechanism does not claim exactly-once cloud deletion. The new offline Node tests cover 255 items over three invocations, retry checkpoints, invalid cursors, ordering and nanosecond ties, aborts, deadlines, and counter integrity.

**Evidence:** 8/8 pure tests were run locally using Node v22.16.0 with experimental type stripping, rather than the required Node v22.23.3. A full exact-head CI on the pinned toolchain, Firestore/Storage emulators with >100 real due documents, deliberate crash/retry and legal holds, as well as independent DPO/SRE review are still required. No production/staging Cloud Firestore data or live schedules were changed. **P0 OPEN / PRODUCTION NO-GO**.

## CI regression 40951315047 — source gate correction (2026-10-29)

On commit `8092c27e42039e0cdbeb340b9d10482ffc48ea58`, Enterprise CI run [40951315047](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/40951315047) **failed** during `check:retention-p0` at the offline boundary test (`test-verification-photo-cron-boundary.mjs`, test 3/3). The assertion incorrectly expected the removed `res.status(failedCount ? 503 : 200)` expression, whereas the paginated route correctly uses `res.status(incomplete ? 503 : 200)` with `incomplete = result.failed > 0 || result.hasMore`. Updated the source gate to assert the new 503 branch while retaining the explicit failure-or-backlog invariant. No functional change to deletion or its response. This fixes a stale test assertion, **not** a verified integration PASS; rerun CI at the updated SHA. Production NO-GO.

## Live emulator cursor evidence — prepared (2026-10-29)

[Enterprise CI #40951718517](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/40951718517) **PASS** on exact prior HEAD `4c0c05f7b114a1173bc4858ffbe7f57283e5ba54`: full enterprise static gates, TypeScript, Functions build, 192 Vitest files / 1,385 tests, Build, Production smoke, and 26 browser acceptance tests. The earlier CI failure #40951315047 was the stale response-variable assertion, fixed in that commit.

A new `tests/verificationPurgeCursorEmulator.spec.ts` test is proposed for the normal CI Firestore emulator profile. It creates **127 synthetic, due Firestore events in a separate named demo-klar emulator database**, with the first 100 marked already purged; verifies real `Timestamp` / document-ID cursor ordering, a durable Firestore checkpoint, a simulated restart to reach the remaining 27, unique IDs and absence of Storage deletion. It requires validated localhost emulator endpoint, demo project identity, nonproduction environment and disabled durable fallback. **Do not call this test PASS before the NEW exact-HEAD CI executes it.** It is an isolated query/cursor integration proof, not proof of the signed HTTP route, lease collision, Storage holds, real photo deletion, data purge SLA or live TTL. P0 #202 / production NO-GO until remaining gates and human approvals.
