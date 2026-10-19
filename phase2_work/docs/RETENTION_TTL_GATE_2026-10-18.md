# P0 #70 — Firestore TTL deployment control (2026-10-18)

Status: **NO-GO; staging-only candidate.** Source commit: `bee87aea09a8d10b2e2c3fb74e38e5ecb12be008`.

## Findings
`scripts/configure-retention.sh` previously covered only 4 of the 13 groups named by `docs/DATA_RETENTION.md`. The replacement enumerates all 13 groups but **does not authorize their production activation**. Before enabling any group, the owner must approve a complete per-group retention matrix, verify `expiresAt` writers (including legacy documents), legal holds and expiry backlog, and assess deletion cost. Contract, conversion and financial records are excluded from this script pending legal agreement.

## Local dry run
```bash
KLAR_PROJECT_ID=klar-staging-123 KLAR_DATABASE_ID='(default)' bash scripts/configure-retention.sh
```
Expected: 13 PLAN lines and DRY RUN ONLY; no gcloud invocation.

## Staging approval only
Set `KLAR_APPLY_RETENTION=true`, `KLAR_ENVIRONMENT=staging`, `KLAR_CONFIRM_RETENTION=project/database`, `KLAR_RETENTION_LEGAL_APPROVED=true`, `KLAR_RETENTION_INVENTORY_APPROVED=true`. The latter flags attest separately archived approvals; environment naming alone does not independently establish whether a cloud project is truly nonproduction. **Only execute from a reviewed deployment runbook after verifying the target project identity and permissions.** Never run this in production.

Verify the actual state with:
```bash
gcloud firestore fields ttls list --project="$KLAR_PROJECT_ID" --database="$KLAR_DATABASE_ID"
```

TTL is asynchronous, non-transactional, and does not recursively delete subcollections. Art. 17 deletion still requires its own independent verified cascade and legal-hold behavior. Rollback of the script means stopping additional policies; already-issued TTL operations or deleted documents cannot simply be undone. No cloud policies, Firebase Emulator scenarios, or complete mandatory gates were tested in this change.

References:
- https://firebase.google.com/docs/firestore/ttl
- https://docs.cloud.google.com/sdk/gcloud/reference/firestore/fields/ttls/update
- https://github.com/Veselin-Takev/Klar-Dating/issues/70
