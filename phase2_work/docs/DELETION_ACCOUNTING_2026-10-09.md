> Historischer Nachweis des Quellbranches `31363ebeb4251d788f877c008c12c5f7d7583e83`. Die hier genannten Testläufe gelten nicht als Validierung des am 10.10.2026 konsolidierten Korrekturbranches; siehe `DELETION_CONSOLIDATION_2026-10-10.md`.

# DB-01: cumulative deletion accounting and final-sweep receipts

Date: 2026-10-09. Candidate follows `fix/deletion-slice-progress`; not deployed.

## Behavior

New deletion requests initialize `accountingVersion: 2` and zeroed `deletedCounts` in the existing `account_deletions/{uid}` document. No new collection or tracking identity is introduced. Seven counter categories retain the established receipt meaning: chats, messages including archives, gate answers, connections, contacts, own reports, and pseudonymized reports. These are not a count of every document or storage object removed by the entire cascade.

Counted queries read the authoritative job and up to 400 matching documents inside one Firestore transaction. The same transaction deletes (or pseudonymizes) those documents and updates the cumulative count. It therefore commits both changes or neither. Replays query remaining data, not a stale page. Concurrent workers conflict on the job/data reads and retry against the authoritative state. A batch requires at most 401 writes (400 records plus the job); there is additional transactional read/write overhead compared with uncounted deletes. No measured production cost saving is claimed.

The request identity and pending status are checked before counted mutations. Worker calls additionally verify lease identity, numeric expiry and current time. The existing cooperative slice accounting remains: confirmed progress preserves the failure budget; genuine errors do not. Lease expiry is not a mechanism to cancel already-running external requests.

`purgeAccountData` requires a stable request ID and an existing valid durable job. It no longer publishes a completion receipt. Its return value describes only that invocation; the job holds cumulative values. The final-sweep worker transaction reads those totals and atomically creates the schema-2 receipt and marks the job completed, after authentication cleanup and the existing token-expiry grace period. Extra data found in the final sweep contributes to the same totals.

The final receipt contains only the seven counters, schema version, status, completion time and 30-day expiry. Its deterministic document ID remains derived from the random request ID; the payload contains no UID, email, raw request ID, provider ID or source text. The completed job follows its existing retention. Pending/manual-review jobs keep their existing no-TTL policy; TTL provisioning in production is a separate operational requirement.

## Failure semantics and evidence

- A failure before commit leaves both data and counters unchanged.
- A lost response after commit may schedule a retry, but the next query finds no deleted rows and does not count them again.
- Concurrent attempts cannot count the same surviving document twice.
- Invalid/missing accounting, a different request or a lost/expired/malformed lease prevents counted mutation.
- A conflicting existing receipt prevents the job-completion transaction from committing. Historical receipts are not overwritten to make the candidate appear successful.
- No receipt is published after the initial purge. Final-sweep completion publishes cumulative totals once; subsequent completed-job calls do nothing.
- The 51-chat emulator fixture verifies exactly 51 chats, 102 messages including archives and 51 gate answers across all pages, repeats the purge without increasing counters, and preserves unrelated data.

Local validation: four targeted files / 26 emulator tests passed with clean orchestrator exit; all three TypeScript projects and Enterprise gates passed. The full application suite passed 159 files / 1,018 tests (Vitest child exit 0), but the local parent orchestrator remained active and was interrupted, so overall test:ci is not claimed as exit 0. Emulator fixtures use synthetic data only. This is not a production restore drill, a provider-deletion certification or a complete storage-retention audit.

## Legacy rollout gate

Existing jobs without valid version-2 accounting cannot reconstruct documents already deleted by earlier attempts. They are moved to `manual_review` with `accounting_migration_required` before disable/provider/purge/authentication actions. **Do not reset their counters to zero and label the result a complete historical total.** Existing schema-1 receipts remain historical evidence and are not migrated automatically.

Before deployment, the operations owner must inventory pending/manual-review jobs in the authorized environment, record the schema distribution and assign every legacy job an owner. No production inventory was available in this workspace, so this gate is open.

For each legacy job, an authorized operator must assess whether destructive work already occurred from available evidence. If totals can be reconstructed, a reviewed transaction can migrate the existing request's accounting and resume it while preserving its genuine failure count. If reconstruction is impossible, a separately approved legacy-completion procedure must explicitly record incomplete historical counting; do not manufacture counts or silently drop the deletion obligation. No automatic migration or legacy-completion tool is shipped in this candidate.

Verify the final-sweep scenario and rollback compatibility in staging before promotion. Earlier workers do not understand cumulative accounting and must not run concurrently with this version or be used as an unreviewed rollback for version-2 jobs. Drain/disable old worker scheduling during controlled rollout; retain pending jobs and counters. Recovery must use a worker that preserves version-2 accounting.

## Release status

Cumulative counting for newly initialized jobs is implemented and locally checked. Production legacy inventory/migration, deployment validation, bounded provider/storage behavior, retention execution, restore evidence and independent approvals remain open. **DB-01 is not unconditionally closed; production remains NO-GO / NOT CONFIRMED.** No new GitHub Actions run or PR is started by saving this candidate.
