# Klar Verification Photo Purge — SRE Alerting Runbook (Draft)
**Date:** 2026-11-05 · **State:** REVIEW ONLY / PRODUCTION NO-GO
**Owners required:** SRE + AppSec + DPO + Release Owner; none are implied approved.

## Scope and privacy
The route and daily Cloud Functions scheduler emit fixed JSON-formatted operational events. Only aggregate counters, booleans and numeric HTTP status are included. Never log full exception objects, document IDs, user IDs, Storage paths, HMAC inputs/secrets/nonces, request or response text.

| Event | Severity | What it means | Action |
| --- | --- | --- | --- |
| `verification_photo_purge_incomplete` | WARNING if hasMore only; ERROR for failed rows or unresolved latch | Bounded scan pending; possibly privacy-relevant backlog | Review recurrence and due-date backlog; investigate failed rows using approved access controls |
| `verification_photo_purge_unavailable` | ERROR | Scan or lease failed without an accepted receipt | Check Firestore emulator/staging and lease; avoid blind retries of destructive operations |
| `verification_photo_purge_p0_live_blocked` | ERROR | A signed request attempted to reach the still-blocked live purge path | Confirm live lock remains engaged, examine Scheduler/flag misconfiguration |
| `verification_photo_purge_scheduler_failed` | ERROR | `stage` = transport, http, or receipt; optional numeric `httpStatus` | Check endpoint, IAM, TLS, HMAC/protocol compatibility and backend status |
| `verification_photo_purge_completed` | INFO | Full clean receipt accepted by scheduler | Verify periodic executions; NOT evidence of Cloud IAM/TTL/reviewer signoff |

### Proposed alerts — not deployed
- **P0 release safety:** Alert on any successful destructive purge in a live environment while VES-5 remains open; use independent Cloud Storage audit logs, not just application-generated events.
- **Scheduler failures:** Notify the SRE on-call for any `verification_photo_purge_scheduler_failed` or `verification_photo_purge_unavailable`. A continuing error beyond one schedule interval requires incident escalation.
- **Failed row persistence:** Notify SRE and the DPO liaison if `failedCount > 0` or `unresolvedFailureBacklog=true` repeats across scheduled runs; do not mark a clean page as a clean cycle.
- **Backlog throughput:** `hasMore=true` with `failedCount=0` needs throughput/capacity review, not a claim of deletion failure. Compare oldest due-date separately using an independently approved, *read-only*, access-controlled retention inventory.
- **Missing runs:** After cloud deployment and alert approval, absence of the expected daily job result for more than one configured interval should trigger escalation; account for UTC 03:00 schedule and retries.

### Logging filters — adapt after actual Cloud validation
Log transport differs by host; structured JSON console entries may appear in `jsonPayload` or as JSON string in `textPayload`. Verify the destination and parser rather than assuming these example filters work in production:
```text
jsonPayload.event="verification_photo_purge_scheduler_failed"
jsonPayload.event="verification_photo_purge_incomplete"
jsonPayload.event="verification_photo_purge_p0_live_blocked"
```
Do not create alert policies, sinks, or retention changes without approved environment inventory and explicit SRE ownership.

## Validation before any release
1. Use a non-production emulator/staging environment with isolated test data. Verify each log's keys and severity, privacy scans and whether the payload is parsed.
2. Simulate HTTP 503, incomplete result, malformed receipt, transport error and active P0 veto; verify error propagation and no authorization to delete a real object.
3. Create independent, authenticated Cloud Storage audit-log checks for actual deleted objects and object-generation/hold controls.
4. Validate test-alert delivery, on-call escalation, mute policy, log retention, IAM least privilege, cost budgets and DPO approval.
5. Verify Firestore TTL `verification_photo_purge_nonces.expiresAt` ACTIVE and the legacy Scheduler actually disabled. Do not infer cloud state from source.
6. Add exact SHA CI, independent AppSec, DPO, SRE and Release Owner signoffs.

## Safe incident response
Do **not** bypass `VERIFICATION_PHOTO_PURGE_P0_LIVE_RELEASE_APPROVED=false`, flip `KLAR_VERIFICATION_PHOTO_PURGE_ENABLED`, manually delete user photos, or merge Draft PRs to clear an alarm. Treat a retention deadline violation as an incident for the DPO/incident commander, preserve minimal audit evidence, and follow an approved remediation/rollback plan. The cross-system Firestore/GCS race is an unsolved P0 and production remains **NO-GO**.
