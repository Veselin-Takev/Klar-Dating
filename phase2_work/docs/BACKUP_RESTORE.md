# Backup and Restore

## Backup

Set `FIRESTORE_DATABASE_ID` to the exact database used by the application (use `(default)` only when that is intentionally the target). Run `scripts/backup-firestore.sh` from a workload identity with export-only permissions. Store exports in a separate project/bucket with retention lock, versioning, encryption, and restricted restore permissions.

## Restore drill

Perform a quarterly restore into an isolated non-production project:

1. Select an immutable export path.
2. Set `KLAR_PROJECT_ID`, `FIRESTORE_DATABASE_ID`, `KLAR_BACKUP_URI`, and an exact `KLAR_CONFIRM_RESTORE`. The database ID must match the database being drilled; never rely on the gcloud default.
3. Run `scripts/restore-firestore.sh`.
4. Compare collection/document counts and sampled checksums.
5. Run API, Rules, and Playwright smoke tests.
6. Record achieved RPO/RTO and delete the isolated environment under the approved retention policy.

Production restores additionally require `KLAR_CHANGE_TICKET`, incident/change approval, traffic isolation, and post-restore reconciliation. A successful export is not evidence of recoverability; only a completed restore drill is.

## Database targeting

Backup and restore commands always pass `--database "$FIRESTORE_DATABASE_ID"`. This is a release-safety invariant because Klar supports named Firestore databases. A project ID alone is not sufficient evidence that the correct database was exported or restored.

## Drill evidence validation

Use `docs/recovery-evidence.template.json` for a real isolated restore or production-approved recovery exercise. Populate only measured values and approved targets, then validate with:

    npx tsx scripts/validate-recovery-evidence.ts path/to/recovery-evidence.json <exact-40-char-build-sha>

The validator requires:

- an exact build SHA and explicit project/database target;
- a concrete immutable backup URI and valid timing sequence;
- pre-approved RPO/RTO targets with named approver and approval timestamp;
- measured RPO and RTO within those targets;
- matching source/restored document counts;
- at least one sampled SHA-256 checksum with exact source/restore match;
- passing API, Rules and Playwright smoke tests;
- when rollback evidence is attached, a 100% revision traffic switch with passing health/readiness checks.

The repository intentionally does not define default RPO/RTO values. Those targets are business/operations decisions and must be approved before the drill.
