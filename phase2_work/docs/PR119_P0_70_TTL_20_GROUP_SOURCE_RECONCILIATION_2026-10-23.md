# PR #119 — P0 #70 Firestore TTL policy source reconciliation (2026-10-23)

**Status: NO-GO / HARD STOP.** This report is an **offline source / mock-GCP review only**; it is **not** evidence of active Cloud TTL, legal hold compliance, Art.-17 completion, or independently approved retention policy.

**Immutable source:** PR #119 `7fdf29010c85f16a9b38e5c93186f32e92192f3a`, Git tree `05f22f0ca387ae37573b1f81e85ead901dce3da9` (GitHub recursive-tree response `truncated=false`). **Scope:** 13 source files, all 13 original bytes independently matched the GitHub Git-blob IDs in the source tree; none of the application's original source scripts were changed here. The single patched source document has a *different* blob ID than original, as expected.

## Discrepancy and precise correction

Issue [#70](https://github.com/Veselin-Takev/Klar-Dating/issues/70) describes an earlier 4-group staging script. That description **does not match** immutable PR #119: `phase2_work/scripts/configure-retention.sh` now enumerates **20 groups**, has default dry-run, explicit staging project and database, legal/inventory and 20-group revision guards, reads existing policies before any apply, and skips already ACTIVE approved groups. It is **not** proof that these have ever been activated in a real Firestore database.

The original `phase2_work/docs/DATA_RETENTION.md` at this exact PR SHA still contains three **outdated operational statements** requiring 13 groups even though the same document later describes a 20-group plan and the current evidence checker requires 20: original source lines **83, 85, 115**. Those three current verification statements are updated to **20**, with explicit **unapproved/unverified** qualification. The historical statement about the former 13-group baseline (original line 126) is preserved as history, **not** rewritten as an active requirement.

## Exact source 20-group matrix (not a legal approval)

| Source stage | Firestore collection-group | TTL field | Real Cloud state |
|---|---|---|---|
| Initial 13 | `messages` | `expiresAt` | **NOT VERIFIED** |
| Initial 13 | `archived_messages` | `expiresAt` | **NOT VERIFIED** |
| Initial 13 | `ki_zwischenspeicher` | `expiresAt` | **NOT VERIFIED** |
| Initial 13 | `age_attempts` | `expiresAt` | **NOT VERIFIED** |
| Initial 13 | `funnel_events` | `expiresAt` | **NOT VERIFIED** |
| Initial 13 | `ai_budget` | `expiresAt` | **NOT VERIFIED** |
| Initial 13 | `kyc_events` | `expiresAt` | **NOT VERIFIED** |
| Initial 13 | `account_deletions` | `expiresAt` | **NOT VERIFIED** |
| Initial 13 | `deletion_log` | `expiresAt` | **NOT VERIFIED** |
| Initial 13 | `partner_referral_click_rate_limits` | `expiresAt` | **NOT VERIFIED** |
| Initial 13 | `partner_referral_webhook_rate_limits` | `expiresAt` | **NOT VERIFIED** |
| Initial 13 | `partner_referral_admin_rate_limits` | `expiresAt` | **NOT VERIFIED** |
| Initial 13 | `partner_referral_user_rate_limits` | `expiresAt` | **NOT VERIFIED** |
| Additional 7 | `password_reset_rate_limits` | `expiresAt` | **NOT VERIFIED** |
| Additional 7 | `verification_mail_rate_limits` | `expiresAt` | **NOT VERIFIED** |
| Additional 7 | `account_deletion_rate_limits` | `expiresAt` | **NOT VERIFIED** |
| Additional 7 | `kyc_start_rate_limits` | `expiresAt` | **NOT VERIFIED** |
| Additional 7 | `kyc_reconciliation_events` | `expiresAt` | **NOT VERIFIED** |
| Additional 7 | `chat_message_rate_limits` | `expiresAt` | **NOT VERIFIED** |
| Additional 7 | `chat_gate_answer_rate_limits` | `expiresAt` | **NOT VERIFIED** |


**Security boundary:** the field and collection-group names above are a static provisioner allowlist only. The lawfulness, retention period, expiry timestamp writers, historical expired records, legal holds, audit evidence retention, and actual Firestore state still need independent approval/review. The value `KLAR_RETENTION_MATRIX_REVISION_APPROVED=expiresAt-20-2026-10-19` is only a confirmation marker and **cannot replace a signed legal decision**.

## Offline checks actually executed

Working directory was an isolated extracted source subset under `/mnt/data`. The six commands below were executed successfully under **Node.js v22.16.0** with real Bash and *mocked* `gcloud` where applicable, and produced their original PASS outputs in `ttl_source_and_mock_tests.log`:

```sh
node scripts/check-retention-matrix.mjs
node scripts/test-retention-matrix.mjs
node scripts/test-retention-active-evidence.mjs
bash scripts/test-retention-gate.sh
bash scripts/test-retention-project-identity.sh
bash scripts/test-retention-staging-live-readonly.sh
```

Covered negative mutations include 13 matrix mutations, 12 final TTL-evidence mutations, 7 preflight mutations, and 13 read-only mock-staging scenarios. The shell-based test also verified default dry-run plan count 20, non-production restrictions, and no unexpected mock writes. **No live GCP calls, policy mutations, Firebase emulator E2E or production/legally approved evidence were performed.** This is not a Host Mandatory Gate under pinned Node.js v22.23.3/Bun 1.4.2.

## Explicit unresolved acceptance criteria

1. DPO/Legal and SRE must authenticate and approve a full, versioned **20-group** retention matrix, field/writer types, permitted durations and hold/exception handling. No implied authorization from this report or the shell's environment-variable flags.
2. Independent **staging** identity, approved credentials, immutable-source hash, fresh read-only `gcloud firestore fields ttls list --project=... --database=... --format=json` evidence and matching `ACTIVE` statuses for all 20 groups. Reconcile **any extra policy** (including CREATING or other fields) before treating evidence as valid.
3. Document retention/legal-hold inventory and billing implications; conduct real Firestore-emulator or staging tests for generated `expiresAt` timestamps and Art.-17 cascading deletion. TTL deletion is asynchronous, nonrecursive and does not enforce legal holds automatically.
4. After staged validation, obtain Security, DPO/Legal, SRE and Release Owner independent approvals plus all 15 qualified mandatory release gates. **0/15 host-gate PASS and 0/4 independent approvals currently evidenced.** Closing #70 or granting production GO is unjustified.

## Change scope and rollback

**Only on** `audit/pr119-host-evidence-governance-2026-10-23`: update three misleading operational assertions in `phase2_work/docs/DATA_RETENTION.md` and append this explicitly non-authoritative reconciliation report plus short references from the audit status/runbook. **Do not** alter PR #119 HEAD, `main`, application runtime code, Firestore TTL policies, legal holds, cloud project or CI settings. Revert these audit-branch document edits to roll back; any real Cloud policy change would need its own separate procedure and cannot be reverted by Git.

## Git-blob provenance of original evidence

The audit compared exact original bytes for 13 relevant files against the immutable GitHub tree, with **13/13 match**. Original `docs/DATA_RETENTION.md` blob `cb2cb6ea17ecb526a60884a6de257d489d335266`; patched documentation blob (audit branch only) `386f2b33f42f3cd7131cc727c7d9b9b132e52a33`. The exact file hashes and evidence limitations are recorded in the handoff manifest.
